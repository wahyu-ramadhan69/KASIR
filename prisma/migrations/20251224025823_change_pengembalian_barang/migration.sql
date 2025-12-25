/*
  Warnings:

  - You are about to drop the column `jumlahDus` on the `PenjualanItem` table. All the data in the column will be lost.
  - You are about to drop the column `jumlahPcs` on the `PenjualanItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PenjualanItem" DROP COLUMN "jumlahDus",
DROP COLUMN "jumlahPcs",
ADD COLUMN     "totalItem" BIGINT NOT NULL DEFAULT 0;
