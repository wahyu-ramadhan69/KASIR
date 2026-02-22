/*
  Warnings:

  - A unique constraint covering the columns `[karyawanId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "karyawanId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_karyawanId_key" ON "User"("karyawanId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
