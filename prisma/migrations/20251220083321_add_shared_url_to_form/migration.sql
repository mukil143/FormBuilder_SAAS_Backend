/*
  Warnings:

  - A unique constraint covering the columns `[sharedUrl]` on the table `Form` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "sharedUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Form_sharedUrl_key" ON "Form"("sharedUrl");
