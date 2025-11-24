/*
  Warnings:

  - You are about to drop the column `limitPembelian` on the `Supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "limitPembelian",
ADD COLUMN     "hutang" INTEGER NOT NULL DEFAULT 0;
