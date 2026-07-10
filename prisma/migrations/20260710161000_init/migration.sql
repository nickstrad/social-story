CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PARSED', 'READY');
CREATE TYPE "RuleKind" AS ENUM ('TOGETHER', 'ALWAYS_INCLUDE', 'NEVER_INCLUDE', 'FREEFORM');
CREATE TYPE "PageKind" AS ENUM ('COVER', 'PAGE');
CREATE TYPE "TaskType" AS ENUM ('PARSE_STORY', 'BASE_IMAGE', 'PAGE_IMAGE', 'PDF_EXPORT');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false, "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
  "id" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Account" (
  "id" TEXT NOT NULL, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT, "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3), "scope" TEXT, "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Verification" (
  "id" TEXT NOT NULL, "identifier" TEXT NOT NULL, "value" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Story" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "title" TEXT NOT NULL, "script" TEXT NOT NULL,
  "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT', "baseImageUrl" TEXT, "coverNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Character" (
  "id" TEXT NOT NULL, "storyId" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT, "age" TEXT,
  "appearance" TEXT, "photoUrl" TEXT, "photoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Rule" (
  "id" TEXT NOT NULL, "storyId" TEXT NOT NULL, "text" TEXT NOT NULL, "kind" "RuleKind" NOT NULL,
  "characterIds" TEXT[], "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Page" (
  "id" TEXT NOT NULL, "storyId" TEXT NOT NULL, "kind" "PageKind" NOT NULL, "position" INTEGER NOT NULL,
  "text" TEXT NOT NULL, "imagePrompt" TEXT NOT NULL, "characterIds" TEXT[], "steeringText" TEXT,
  "hidden" BOOLEAN NOT NULL DEFAULT false, "selectedImageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PageImage" (
  "id" TEXT NOT NULL, "pageId" TEXT NOT NULL, "url" TEXT NOT NULL, "rawUrl" TEXT,
  "promptUsed" TEXT NOT NULL, "variant" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PageImage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Task" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "storyId" TEXT NOT NULL, "pageId" TEXT,
  "type" "TaskType" NOT NULL, "status" "TaskStatus" NOT NULL DEFAULT 'PENDING', "error" TEXT,
  "resultJson" JSONB, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE INDEX "Story_userId_idx" ON "Story"("userId");
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");
CREATE INDEX "Rule_storyId_idx" ON "Rule"("storyId");
CREATE UNIQUE INDEX "Page_selectedImageId_key" ON "Page"("selectedImageId");
CREATE INDEX "Page_storyId_position_idx" ON "Page"("storyId", "position");
CREATE INDEX "PageImage_pageId_variant_idx" ON "PageImage"("pageId", "variant");
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
CREATE INDEX "Task_pageId_idx" ON "Task"("pageId");
CREATE INDEX "Task_storyId_status_idx" ON "Task"("storyId", "status");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_selectedImageId_fkey" FOREIGN KEY ("selectedImageId") REFERENCES "PageImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PageImage" ADD CONSTRAINT "PageImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
