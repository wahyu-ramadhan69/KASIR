/*
  Warnings:

  - You are about to drop the column `jumlahDus` on the `PembelianItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PembelianItem" DROP COLUMN "jumlahDus",
ADD COLUMN     "totalItem" BIGINT NOT NULL DEFAULT 0;
