-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "razorpayKeyId" TEXT,
    "razorpayKeySecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "razorpayPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "period" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_planType_key" ON "Plan"("planType");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_razorpayPlanId_key" ON "Plan"("razorpayPlanId");
