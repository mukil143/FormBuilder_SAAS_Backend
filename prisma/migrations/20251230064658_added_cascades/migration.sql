-- DropForeignKey
ALTER TABLE "Form" DROP CONSTRAINT "Form_userId_fkey";

-- DropForeignKey
ALTER TABLE "FormResponse" DROP CONSTRAINT "FormResponse_formId_fkey";

-- DropForeignKey
ALTER TABLE "FormResponse" DROP CONSTRAINT "FormResponse_userId_fkey";

-- DropForeignKey
ALTER TABLE "MasterField" DROP CONSTRAINT "MasterField_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResponseValue" DROP CONSTRAINT "ResponseValue_formFieldId_fkey";

-- DropForeignKey
ALTER TABLE "ResponseValue" DROP CONSTRAINT "ResponseValue_formResponseId_fkey";

-- DropForeignKey
ALTER TABLE "UserReport" DROP CONSTRAINT "UserReport_userId_fkey";

-- AddForeignKey
ALTER TABLE "MasterField" ADD CONSTRAINT "MasterField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("formId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseValue" ADD CONSTRAINT "ResponseValue_formResponseId_fkey" FOREIGN KEY ("formResponseId") REFERENCES "FormResponse"("formResponseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseValue" ADD CONSTRAINT "ResponseValue_formFieldId_fkey" FOREIGN KEY ("formFieldId") REFERENCES "FormField"("formFieldId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
