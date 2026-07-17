# Plan 14 — Private Asset Registry and Authorized Blob Delivery

**Depends on:** 02, 06, 09, 10, 12, 13.

## Context and research

The app currently uploads every character photo, generated image, raw page image,
and PDF with `access: "public"`, stores the returned Vercel URL in Postgres, and
returns those URLs to the browser. The tRPC authorization is sound, but it only
protects discovery: anyone who obtains a Blob URL can fetch the bytes without an
app session.

Vercel's current storage choices differ as follows:

| Mode                       | Read access                                             | Delivery                        | Fit here                             |
| -------------------------- | ------------------------------------------------------- | ------------------------------- | ------------------------------------ |
| Public store               | Anyone with the URL                                     | Browser reads Blob directly     | Reject for user content              |
| Private store + app route  | Blob credential plus app authorization on every request | Function streams `get()`        | Chosen default                       |
| Private store + signed URL | Anyone holding the scoped URL until it expires          | Browser reads Blob CDN directly | Defer to an explicit sharing feature |

Important platform findings:

- A store's public/private access mode cannot be changed after creation. This
  app is pre-production and its development data is disposable, so cutover uses
  a fresh private store and database reset rather than a data migration.
- `@vercel/blob` 2.6.1, already installed here, supports private `put()` and
  streaming `get()`, conditional reads, OIDC credentials, and signed URLs.
- Vercel recommends OIDC on Vercel because the token is short-lived and rotated;
  an explicitly passed `BLOB_READ_WRITE_TOKEN` takes precedence and would keep
  the current long-lived-secret behavior.
- Next Image Optimization does not forward authentication headers. Authenticated
  images must bypass it so the browser sends its session cookie to the app route.
- Private delivery through a Function costs more than direct public delivery,
  but these assets are small user images/PDFs and require per-user access control.

Sources: [Vercel Blob public/private comparison](https://vercel.com/docs/vercel-blob),
[private delivery and caching](https://vercel.com/docs/vercel-blob/private-storage),
[SDK and OIDC authentication](https://vercel.com/docs/vercel-blob/using-blob-sdk),
[signed URL behavior](https://vercel.com/docs/vercel-blob/vercel-signed-urls), and
[Next Image authenticated-source behavior](https://nextjs.org/docs/app/api-reference/components/image#src).

### DigitalOcean Spaces alternative (evaluated, not chosen)

DigitalOcean Spaces is a viable object store, but it is not a simpler privacy
fix for this Vercel-hosted app:

| Concern                 | Vercel private Blob                      | DigitalOcean Spaces                             | Result                |
| ----------------------- | ---------------------------------------- | ----------------------------------------------- | --------------------- |
| Existing integration    | Current SDK and adapter                  | Add AWS S3 SDK and replace adapter              | Vercel simpler        |
| Private objects         | Store-level private mode                 | Per-object/bucket private ACL                   | Equivalent outcome    |
| App ownership           | Authenticated app route or signed URL    | Authenticated app route or presigned URL        | Same application work |
| Server credential       | Rotating Vercel OIDC                     | Static Spaces access key and secret             | Vercel safer/simpler  |
| Direct private delivery | Signed URLs use Blob CDN                 | Presigned requests are not cached by Spaces CDN | Vercel better fit     |
| Pre-production reset    | Recreate objects in a private Blob store | Recreate objects in a private Space             | Equivalent reset      |
| Portability             | Vercel-specific SDK                      | Partially S3-compatible API                     | Spaces advantage      |

Spaces supports private ACLs, presigned URLs, bucket policies, and AWS SDK
clients, but its S3 compatibility is explicitly partial. A production adapter
would need a bucket, endpoint, AWS compatibility region, access key, secret,
ACL enforcement, and new SDK dependencies. Because the app runs on Vercel, an
authenticated proxy would also add a cross-provider hop from the Vercel
Function to Spaces before returning bytes to the browser. Using presigned URLs
would avoid that Function hop but would retain the same copy-until-expiry
security tradeoff, and DigitalOcean documents that presigned requests do not
benefit from its CDN cache.

Spaces has predictable pricing—currently a $5/month base including 250 GiB of
storage and 1 TiB of outbound transfer—and is attractive if S3 portability or a
broader move away from Vercel is a product goal. It is not a simplification for
this isolated access-control change. Keep the storage port provider-neutral so
a later infrastructure-driven pivot only replaces the adapter and provisioning,
not the owned-asset route or browser DTO boundary.

Sources: [Spaces S3 compatibility and ACLs](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/),
[AWS SDK configuration](https://docs.digitalocean.com/products/spaces/how-to/use-aws-sdks/),
[private files and presigned URLs](https://docs.digitalocean.com/products/spaces/how-to/set-file-permissions/),
[presigned URL CDN limitation](https://docs.digitalocean.com/products/spaces/how-to/manage-cdn-cache/),
[access keys](https://docs.digitalocean.com/products/spaces/how-to/manage-access/),
and [Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/).

## Security decisions

- Put all user-owned blobs in one new **private** Vercel store. Use OIDC
  (`BLOB_STORE_ID` + Vercel-managed `VERCEL_OIDC_TOKEN`) in deployments and a
  static private-store token only for local development or one-off operations.
- Make Postgres `Asset` rows the only application-visible registry of stored
  files. Each row carries its owner, story, kind, private storage locator, and
  response metadata. Domain records reference asset IDs instead of Blob URLs.
- Deliver browser-visible content only through
  `GET /api/me/assets/[assetId]`. `me` comes exclusively from the Better Auth
  session; no user ID or token claim is accepted from the URL.
- Authorize with one owner-scoped query equivalent to
  `WHERE id = :assetId AND userId = :sessionUserId`. The asset ID is an opaque
  identifier, not a credential. Never decode a JWT manually or trust a pathname
  to establish ownership.
- Return `401` when there is no Better Auth session and an indistinguishable
  `404` for missing, non-owned, or non-browser-visible assets. Raw page images
  are registered for server use but their kind is rejected by the browser route.
- Better Auth and Blob authentication remain separate layers: Better Auth proves
  which app user is requesting the `Asset`; Vercel OIDC lets the trusted server
  fetch that row's private locator.
- Do not mint routine signed URLs. A copied signed URL remains usable until
  expiry and bypasses immediate Better Auth revocation. Reserve them for a later
  explicit sharing feature.

## Implementation

### 1. Asset schema and repository

Add `AssetKind` values `BASE_IMAGE`, `CHARACTER_PHOTO`, `PAGE_IMAGE`,
`PAGE_IMAGE_RAW`, and `PDF`, plus an `Asset` model with:

- `id`, `userId`, `storyId`, `kind`, `storageLocator` (unique), `contentType`,
  `byteLength`, optional `filename`, and timestamps.
- A compound relation from the asset's `storyId` and `userId` to the story's
  unique `id` and `userId` pair. This makes it impossible to register an asset
  under a user different from its owning story while retaining the fast
  owner-scoped route query.
- Indexes on `(userId, id)` and `storyId`. The browser-readable asset kinds are a
  server constant, not a database flag clients can influence.

Replace storage URL references with asset IDs:

- `Story.baseImageUrl` becomes nullable `baseImageAssetId`.
- `Character.photoUrl` becomes nullable `photoAssetId`.
- `PageImage.url` and `rawUrl` become `imageAssetId` and nullable `rawAssetId`;
  both reference `Asset` through separately named relations.
- Asset-producing task results use an `assetId` instead of a `url`; PDF task
  results retain `pageCount` and page generation retains `pageImageId`.

Add an `AssetRepo` with owner lookup, lookup/list by IDs and story, create,
replace, and delete operations in both Prisma and memory implementations. Asset
IDs and asset-aware client DTOs are public types; `storageLocator` is confined to
server repository/service types and must never cross tRPC or route responses.

### 2. Private storage and asset lifecycle

- Extend `Storage` with a streaming conditional read that returns a 200 stream
  plus metadata, a 304 result, or not found. Implement `fetchBuffer()` on that
  read so image references and PDF assembly use authenticated private storage.
- Change the Vercel adapter to private `put()` and `get()`, immutable random
  suffixes, conditional `ifNoneMatch` reads, and authenticated delete. Accept
  either the complete OIDC pair or a static token; prefer OIDC and never log
  credentials.
- Centralize writes in an asset service. Upload the immutable blob first, then
  create/update the `Asset` row and its domain reference in a database
  transaction. On failure, best-effort delete the new private blob. On
  replacement, swap the reference atomically, delete the old `Asset` row, then
  best-effort delete its old blob.
- Page generation uploads raw and captioned bytes, then transactionally creates
  the `PageImage` plus both `Asset` rows/references. A failed database transaction
  cleans up both new blobs. Base regeneration and character photo replacement use
  the same swap semantics; PDF export creates one `PDF` asset owned by the task's
  story.
- Before deleting or replacing stories, characters, pages, page images, or PDF
  tasks, collect their asset locators and delete the `Asset` rows with the domain
  mutation. Blob deletion remains best-effort after the database no longer makes
  the asset addressable. Story deletion uses the story relation to cascade asset
  rows, but loads locators before the cascade for Blob cleanup.

### 3. Better Auth route and browser contract

- Implement `GET /api/me/assets/[assetId]`: read the Better Auth session from
  request headers, query `Asset` using its `id`, `session.user.id`, and the
  browser-readable kind allowlist, then stream `storageLocator`. The route never
  accepts a Blob URL, pathname, story ID, or user ID.
- Forward `If-None-Match` to storage and return 304 without a body when
  unchanged. On 200 set authoritative content type/length, `ETag`,
  `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-cache`, and
  `Vary: Cookie`. Images are inline; PDFs use an attachment disposition with the
  sanitized `Asset.filename`.
- Add one `assetUrl(assetId)` helper returning `/api/me/assets/{assetId}`. Client
  DTO mappers keep convenient fields such as `baseImageUrl`, `photoUrl`,
  `selectedImageUrl`, artifact `url`, and PDF `url`, but derive every value from
  an asset ID. No browser payload contains `storageLocator` or a Blob hostname.
- Update all server consumers to load assets from `AssetRepo`: base/page image
  reference inputs, selected variants, artifact aggregation, PDF assembly,
  photo/base replacement, and story cleanup. The browser never proxies through
  these URLs for server-to-server reads.
- Dynamic private images use `next/image` with `unoptimized` or the existing
  native image wrapper so the browser sends its Better Auth cookie. Remove the
  public Blob `remotePatterns` entry. E2E fake storage also stays behind the same
  authenticated asset route; retire `/api/test-storage/...`.

### 4. Artifact catalog pivot

Keep `Asset` and `Artifact` as separate concepts: `Asset` is the persisted,
owned storage record; `Artifact` remains the presentation DTO used by the
artifacts page.

- Change `artifactRouter.list` to batch-load the signed-in user's stories,
  source records, and `Asset` rows through `AssetRepo`. Preserve the current
  batched `listByStoryIds` shape so the pivot does not reintroduce per-story
  queries.
- Change `collectArtifacts` to join domain references to assets by ID rather
  than reading `Story.baseImageUrl`, `Character.photoUrl`, `PageImage.url`, or
  task `resultJson.url`. It emits `assetUrl(asset.id)` and never exposes
  `storageLocator`.
- Preserve catalog semantics: include the current base image, character photos,
  selected captioned page images, and completed PDF assets. Exclude
  `PAGE_IMAGE_RAW`, unselected page variants, deleted/replaced assets, and task
  results without a valid owned `assetId`.
- Use the linked `Character`, `Page`, `PageImage`, `Task`, and `Story` metadata
  for labels, story titles, timestamps, and click-through destinations. Use the
  `Asset` ID as the stable artifact ID; the "Open original" link points to the
  protected `/api/me/assets/{assetId}` route.
- Update artifact domain/router tests and the artifacts-page Playwright spec to
  seed `Asset` rows and asset-ID references, assert newest-first ordering and
  selected-image filtering, verify raw assets are absent, and prove another
  user's assets and every storage locator are excluded.

### 5. Clean-install schema and pre-production reset

The app is not in production and all existing development database and Blob data
is disposable. Install the registry in its final shape in one Prisma migration:
create `Asset`, add the final asset-ID references and ownership constraints, and
drop the legacy URL columns immediately. Do not carry a backfill/finalization
operator or a temporary nullable-reference window.

For cutover, provision/connect the private store and OIDC, wipe the development
database and old app-owned Blob objects, apply the migrations to the empty
database, deploy, and smoke-test owner, logged-out, and second-user access.

## Tests and acceptance

- Unit-test the compound owner invariant, `AssetRepo.getOwnedById`, rejection of
  raw assets, and asset lifecycle swaps/cleanup. Cross-user requests must return
  the same 404 as missing IDs even if the caller knows an asset ID.
- Unit-test credential selection and storage: private writes/reads, authenticated
  delete, 200/304/not-found mapping, ETag forwarding, and no explicit static
  token when OIDC is selected.
- Integration-test every producer and consumer with in-memory repos/storage:
  photo upload/replacement, base and page generation, raw image server access,
  selection, PDF export, artifact listing, page/story deletion, and task results.
  Assert client DTOs contain only `/api/me/assets/...` and never locators.
- Add Playwright coverage for owner image/PDF access through the protected route,
  then verify the same URL returns 401 after logout and 404 to a second user.
  Keep the isolated port 3100 server and deterministic external-service fakes.
- Run `npm run test:run`, `npm run lint`, `npm run build`, and
  `npm run test:e2e`.
- Acceptance requires: all user blobs are private; all domain references use
  `Asset` IDs; no Blob hostname appears in browser payloads/network requests;
  `/api/me/assets/{id}` enforces the Better Auth owner lookup; raw assets are not
  browser-readable; direct private Blob URLs fail without Vercel authorization;
  legacy URL columns are removed; and the old public `stories/` prefix is empty.

## Assumptions and exclusions

- Story ownership is immutable. The compound `(storyId, userId)` relationship is
  the database-enforced source of every asset's owner.
- The pre-production reset wipes only this app's disposable `stories/` prefix
  and development database.
- User assets remain below Vercel's recommended 100 MB threshold for private
  Function delivery; current 1024px images and generated PDFs satisfy this.
- Public marketing/build assets remain static app files. Direct client uploads,
  signed sharing, custom asset domains, and a DigitalOcean pivot are out of
  scope.
- Provisioning and the pre-production reset require user credentials;
  implementation stops and asks rather than inferring or inspecting secrets.
