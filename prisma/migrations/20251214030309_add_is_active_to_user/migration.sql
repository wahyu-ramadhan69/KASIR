/*
  Warnings:

  - You are about to drop the column `jumlahDus` on the `ManifestBarang` table. All the data in the column will be lost.
  - You are about to drop the column `jumlahPcs` on the `ManifestBarang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ManifestBarang" DROP COLUMN "jumlahDus",
DROP COLUMN "jumlahPcs";
