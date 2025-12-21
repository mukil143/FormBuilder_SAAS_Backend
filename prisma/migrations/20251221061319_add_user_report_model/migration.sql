-- CreateTable
CREATE TABLE "UserReport" (
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("reportId")
);

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
