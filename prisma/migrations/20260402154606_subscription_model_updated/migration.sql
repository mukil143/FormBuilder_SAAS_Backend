/*
  Warnings:

  - Added the required column `planId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `plan` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "planId" TEXT NOT NULL,
DROP COLUMN "plan",
ADD COLUMN     "plan" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
