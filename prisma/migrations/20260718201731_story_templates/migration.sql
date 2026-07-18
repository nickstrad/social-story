-- CreateEnum
CREATE TYPE "StoryKind" AS ENUM ('STORY', 'TEMPLATE');

-- DropIndex
DROP INDEX "Story_userId_idx";

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "kind" "StoryKind" NOT NULL DEFAULT 'STORY',
ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE INDEX "Story_userId_kind_idx" ON "Story"("userId", "kind");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
