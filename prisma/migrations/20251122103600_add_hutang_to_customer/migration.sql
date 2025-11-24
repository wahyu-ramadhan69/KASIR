/*
  Warnings:

  - You are about to drop the column `hutang` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `limit_hutang` on the `Customer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "hutang",
DROP COLUMN "limit_hutang",
ADD COLUMN     "limit_piutang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "piutang" INTEGER NOT NULL DEFAULT 0;
