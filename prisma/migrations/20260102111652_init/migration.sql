/*
  Warnings:

  - You are about to drop the column `cicilanPerBulan` on the `Karyawan` table. All the data in the column will be lost.
  - You are about to drop the column `sisaPinjaman` on the `Karyawan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Karyawan" DROP COLUMN "cicilanPerBulan",
DROP COLUMN "sisaPinjaman";

-- CreateTable
CREATE TABLE "PinjamanKaryawan" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "jumlahPinjaman" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinjamanKaryawan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PembayaranHutangKaryawan" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "jumlahbayar" INTEGER NOT NULL,
    "userId" INTEGER,
    "tanggalbayar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PembayaranHutangKaryawan_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PinjamanKaryawan" ADD CONSTRAINT "PinjamanKaryawan_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PembayaranHutangKaryawan" ADD CONSTRAINT "PembayaranHutangKaryawan_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
