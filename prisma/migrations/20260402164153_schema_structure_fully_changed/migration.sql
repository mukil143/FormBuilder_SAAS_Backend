/*
  Warnings:

  - You are about to drop the column `activeformLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `dailyresponseLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `monthlyresponseLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `apiKeyLimit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `formLimit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `themeAccess` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userLimit` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[planType,period]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `period` on the `Plan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `apiKeyLimit` on table `Plan` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userLimit` on table `Plan` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- DropIndex
DROP INDEX "Plan_planType_key";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "activeformLimit",
DROP COLUMN "dailyresponseLimit",
DROP COLUMN "monthlyresponseLimit",
ADD COLUMN     "activeFormLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyResponseLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyResponseLimit" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "period",
ADD COLUMN     "period" "BillingPeriod" NOT NULL,
ALTER COLUMN "apiKeyLimit" SET NOT NULL,
ALTER COLUMN "apiKeyLimit" SET DEFAULT 0,
ALTER COLUMN "userLimit" SET NOT NULL,
ALTER COLUMN "userLimit" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "isActive",
DROP COLUMN "plan";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "apiKeyLimit",
DROP COLUMN "formLimit",
DROP COLUMN "plan",
DROP COLUMN "themeAccess",
DROP COLUMN "userLimit";

-- CreateIndex
CREATE INDEX "Plan_planType_idx" ON "Plan"("planType");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_planType_period_key" ON "Plan"("planType", "period");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
