/*
  Warnings:

  - You are about to drop the column `jumlahPerkardus` on the `Barang` table. All the data in the column will be lost.
  - Added the required column `jenisKemasan` to the `Barang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jumlahPerKemasan` to the `Barang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenisPengeluaran` to the `Pengeluaran` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Barang" DROP COLUMN "jumlahPerkardus",
ADD COLUMN     "jenisKemasan" TEXT NOT NULL,
ADD COLUMN     "jumlahPerKemasan" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "Pengeluaran" ADD COLUMN     "jenisPengeluaran" TEXT NOT NULL;
