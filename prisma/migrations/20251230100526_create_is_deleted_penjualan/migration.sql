/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `PenjualanItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PenjualanHeader" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PenjualanItem" DROP COLUMN "isDeleted";
