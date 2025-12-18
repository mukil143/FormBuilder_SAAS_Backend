/*
  Warnings:

  - Added the required column `type` to the `FormField` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "options" JSONB,
ADD COLUMN     "type" "FieldType" NOT NULL,
ALTER COLUMN "order" SET DEFAULT 0;
