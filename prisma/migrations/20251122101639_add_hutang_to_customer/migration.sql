/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `PenjualanHeader` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "hutang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "limit_hutang" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PenjualanHeader" DROP COLUMN "isAdmin";
