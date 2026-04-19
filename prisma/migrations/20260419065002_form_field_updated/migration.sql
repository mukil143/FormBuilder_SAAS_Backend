-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "defaultValue" TEXT,
ADD COLUMN     "placeholder" TEXT,
ADD COLUMN     "readOnly" BOOLEAN NOT NULL DEFAULT false;
