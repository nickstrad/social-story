CREATE TYPE "AssetKind" AS ENUM ('BASE_IMAGE', 'CHARACTER_PHOTO', 'PAGE_IMAGE', 'PAGE_IMAGE_RAW', 'PDF');

ALTER TABLE "Story" ADD COLUMN "baseImageAssetId" TEXT;
ALTER TABLE "Character" ADD COLUMN "photoAssetId" TEXT;
ALTER TABLE "PageImage" ADD COLUMN "imageAssetId" TEXT NOT NULL;
ALTER TABLE "PageImage" ADD COLUMN "rawAssetId" TEXT;

CREATE UNIQUE INDEX "Story_id_userId_key" ON "Story"("id", "userId");

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "kind" "AssetKind" NOT NULL,
  "storageLocator" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "filename" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_storageLocator_key" ON "Asset"("storageLocator");
CREATE INDEX "Asset_userId_id_idx" ON "Asset"("userId", "id");
CREATE INDEX "Asset_storyId_idx" ON "Asset"("storyId");
CREATE UNIQUE INDEX "Story_baseImageAssetId_key" ON "Story"("baseImageAssetId");
CREATE UNIQUE INDEX "Character_photoAssetId_key" ON "Character"("photoAssetId");
CREATE UNIQUE INDEX "PageImage_imageAssetId_key" ON "PageImage"("imageAssetId");
CREATE UNIQUE INDEX "PageImage_rawAssetId_key" ON "PageImage"("rawAssetId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_storyId_userId_fkey"
  FOREIGN KEY ("storyId", "userId") REFERENCES "Story"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_baseImageAssetId_fkey"
  FOREIGN KEY ("baseImageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_photoAssetId_fkey"
  FOREIGN KEY ("photoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PageImage" ADD CONSTRAINT "PageImage_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PageImage" ADD CONSTRAINT "PageImage_rawAssetId_fkey"
  FOREIGN KEY ("rawAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- This application is pre-production and the development database is
-- disposable, so the asset registry is installed in its final shape without a
-- legacy-data backfill window.
ALTER TABLE "Story" DROP COLUMN "baseImageUrl";
ALTER TABLE "Character" DROP COLUMN "photoUrl";
ALTER TABLE "PageImage" DROP COLUMN "url";
ALTER TABLE "PageImage" DROP COLUMN "rawUrl";
