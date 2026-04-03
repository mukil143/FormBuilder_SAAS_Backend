/*
  Warnings:

  - The values [MONTHLY,YEARLY] on the enum `BillingPeriod` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BillingPeriod_new" AS ENUM ('monthly', 'yearly');
ALTER TABLE "Plan" ALTER COLUMN "period" TYPE "BillingPeriod_new" USING ("period"::text::"BillingPeriod_new");
ALTER TYPE "BillingPeriod" RENAME TO "BillingPeriod_old";
ALTER TYPE "BillingPeriod_new" RENAME TO "BillingPeriod";
DROP TYPE "public"."BillingPeriod_old";
COMMIT;
