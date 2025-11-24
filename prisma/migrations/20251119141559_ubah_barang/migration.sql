/*
  Warnings:

  - You are about to drop the column `jenisBarangId` on the `Barang` table. All the data in the column will be lost.
  - You are about to drop the `JenisBarang` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `jumlahPerkardus` to the `Barang` table without a default value. This is not possible if the table is not empty.
  - Added the required column `satuan` to the `Barang` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Barang" DROP CONSTRAINT "Barang_jenisBarangId_fkey";

-- AlterTable
ALTER TABLE "Barang" DROP COLUMN "jenisBarangId",
ADD COLUMN     "jumlahPerkardus" INTEGER NOT NULL,
ADD COLUMN     "satuan" TEXT NOT NULL,
ALTER COLUMN "stok" SET DEFAULT 0;

-- DropTable
DROP TABLE "JenisBarang";
