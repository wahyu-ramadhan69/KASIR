/*
  Warnings:

  - You are about to drop the column `limitStok` on the `Barang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Barang" DROP COLUMN "limitStok",
ADD COLUMN     "limitPenjualan" BIGINT NOT NULL DEFAULT 0;
