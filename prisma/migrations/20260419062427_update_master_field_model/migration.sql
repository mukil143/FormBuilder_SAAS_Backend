-- AlterTable
ALTER TABLE "MasterField" ADD COLUMN     "placeHolder" TEXT,
ADD COLUMN     "readOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT false;
