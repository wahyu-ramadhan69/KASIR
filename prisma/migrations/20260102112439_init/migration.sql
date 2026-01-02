-- AlterEnum
ALTER TYPE "JenisKaryawan" ADD VALUE 'KARYAWAN';

-- AlterTable
ALTER TABLE "Karyawan" ADD COLUMN     "totalPembayaranHutang" INTEGER NOT NULL DEFAULT 0;
