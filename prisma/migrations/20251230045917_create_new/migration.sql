/*
  Warnings:

  - You are about to drop the column `tunjanganMakanPerHari` on the `Karyawan` table. All the data in the column will be lost.
  - Added the required column `tunjanganMakan` to the `Karyawan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Barang" ADD COLUMN     "berat" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "limitStok" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Karyawan" DROP COLUMN "tunjanganMakanPerHari",
ADD COLUMN     "tunjanganMakan" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PenjualanHeader" ADD COLUMN     "beratTotal" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PenjualanItem" ADD COLUMN     "berat" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
