/*
  Warnings:

  - You are about to drop the column `name` on the `MasterField` table. All the data in the column will be lost.
  - Added the required column `label` to the `MasterField` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MasterField" RENAME COLUMN "name" TO "label";
