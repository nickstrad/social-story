-- CreateEnum
CREATE TYPE "PageImageSource" AS ENUM ('AI', 'UPLOAD');

-- AlterTable
ALTER TABLE "PageImage" ADD COLUMN     "source" "PageImageSource" NOT NULL DEFAULT 'AI',
ALTER COLUMN "promptUsed" DROP NOT NULL;
