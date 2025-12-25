/*
  Warnings:

  - You are about to drop the column `namaCustomer` on the `PenjualanHeader` table. All the data in the column will be lost.
  - You are about to drop the column `rutePengiriman` on the `PenjualanHeader` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PenjualanHeader" DROP COLUMN "namaCustomer",
DROP COLUMN "rutePengiriman";
