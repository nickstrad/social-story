-- AlterEnum
ALTER TYPE "AssetKind" ADD VALUE 'LIBRARY_PHOTO';

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "storyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "libraryCharacterId" TEXT;

-- CreateTable
CREATE TABLE "LibraryCharacter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "age" TEXT,
    "appearance" TEXT,
    "photoAssetId" TEXT,
    "photoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharacter_photoAssetId_key" ON "LibraryCharacter"("photoAssetId");

-- CreateIndex
CREATE INDEX "LibraryCharacter_userId_idx" ON "LibraryCharacter"("userId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_libraryCharacterId_fkey" FOREIGN KEY ("libraryCharacterId") REFERENCES "LibraryCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharacter" ADD CONSTRAINT "LibraryCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharacter" ADD CONSTRAINT "LibraryCharacter_photoAssetId_fkey" FOREIGN KEY ("photoAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
