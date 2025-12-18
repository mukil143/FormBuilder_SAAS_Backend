-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE');

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MasterField" (
    "masterFieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "options" JSONB,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MasterField_pkey" PRIMARY KEY ("masterFieldId")
);

-- CreateTable
CREATE TABLE "Form" (
    "formId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("formId")
);

-- CreateTable
CREATE TABLE "FormField" (
    "formFieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "formId" TEXT NOT NULL,
    "masterFieldId" TEXT,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("formFieldId")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "formResponseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("formResponseId")
);

-- CreateTable
CREATE TABLE "ResponseValue" (
    "responseValueId" TEXT NOT NULL,
    "value" JSONB,
    "formResponseId" TEXT NOT NULL,
    "formFieldId" TEXT NOT NULL,

    CONSTRAINT "ResponseValue_pkey" PRIMARY KEY ("responseValueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");

-- AddForeignKey
ALTER TABLE "MasterField" ADD CONSTRAINT "MasterField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("formId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_masterFieldId_fkey" FOREIGN KEY ("masterFieldId") REFERENCES "MasterField"("masterFieldId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("formId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseValue" ADD CONSTRAINT "ResponseValue_formResponseId_fkey" FOREIGN KEY ("formResponseId") REFERENCES "FormResponse"("formResponseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseValue" ADD CONSTRAINT "ResponseValue_formFieldId_fkey" FOREIGN KEY ("formFieldId") REFERENCES "FormField"("formFieldId") ON DELETE RESTRICT ON UPDATE CASCADE;
