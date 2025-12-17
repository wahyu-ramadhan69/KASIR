/*
  Warnings:

  - You are about to drop the column `salesId` on the `PenjualanHeader` table. All the data in the column will be lost.
  - You are about to drop the `Sales` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "JenisKaryawan" AS ENUM ('KASIR', 'SALES');

-- DropForeignKey
ALTER TABLE "PenjualanHeader" DROP CONSTRAINT "PenjualanHeader_salesId_fkey";

-- AlterTable
ALTER TABLE "PenjualanHeader" DROP COLUMN "salesId",
ADD COLUMN     "karyawanId" INTEGER;

-- DropTable
DROP TABLE "Sales";

-- CreateTable
CREATE TABLE "Karyawan" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "noHp" TEXT,
    "alamat" TEXT,
    "jenis" "JenisKaryawan" NOT NULL,
    "gajiPokok" INTEGER NOT NULL,
    "tunjanganMakanPerHari" INTEGER NOT NULL,
    "totalPinjaman" INTEGER NOT NULL DEFAULT 0,
    "sisaPinjaman" INTEGER NOT NULL DEFAULT 0,
    "cicilanPerBulan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Karyawan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Karyawan_nik_key" ON "Karyawan"("nik");

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
