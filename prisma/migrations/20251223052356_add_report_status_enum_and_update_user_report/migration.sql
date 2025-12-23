/*
  Warnings:

  - Added the required column `updatedAt` to the `UserReport` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Rised', 'InProgress', 'Resolved', 'Closed');

-- AlterTable
ALTER TABLE "UserReport" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'Rised',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
