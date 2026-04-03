/*
  Warnings:

  - Added the required column `updatedAt` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "activeformLimit" INTEGER,
ADD COLUMN     "apiKeyLimit" INTEGER,
ADD COLUMN     "dailyresponseLimit" INTEGER,
ADD COLUMN     "monthlyresponseLimit" INTEGER,
ADD COLUMN     "themeAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userLimit" INTEGER;
