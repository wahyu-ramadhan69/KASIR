/*
  Warnings:

  - You are about to drop the column `satuan` on the `Barang` table. All the data in the column will be lost.
  - You are about to drop the column `ukuran` on the `Barang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Barang" DROP COLUMN "satuan",
DROP COLUMN "ukuran";
