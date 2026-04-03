-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "razorpayWebhookSecret" TEXT;
