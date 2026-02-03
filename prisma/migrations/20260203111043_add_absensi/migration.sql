-- CreateEnum
CREATE TYPE "StatusAbsensi" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALPHA', 'LIBUR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JenisKaryawan" ADD VALUE 'KEPALA_GUDANG';
ALTER TYPE "JenisKaryawan" ADD VALUE 'OWNER';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KEPALA_GUDANG';

-- CreateTable
CREATE TABLE "Absensi" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jamMasuk" TIMESTAMP(3),
    "jamKeluar" TIMESTAMP(3),
    "status" "StatusAbsensi" NOT NULL DEFAULT 'HADIR',
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Absensi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Absensi_tanggal_idx" ON "Absensi"("tanggal");

-- CreateIndex
CREATE INDEX "Absensi_karyawanId_idx" ON "Absensi"("karyawanId");

-- CreateIndex
CREATE UNIQUE INDEX "Absensi_karyawanId_tanggal_key" ON "Absensi"("karyawanId", "tanggal");

-- AddForeignKey
ALTER TABLE "Absensi" ADD CONSTRAINT "Absensi_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
