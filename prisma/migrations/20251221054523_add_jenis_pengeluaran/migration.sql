/*
  Warnings:

  - The `jenisPengeluaran` column on the `Pengeluaran` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "JenisPengeluaran" AS ENUM ('HARIAN', 'BULANAN', 'TAHUNAN');

-- AlterTable
ALTER TABLE "Pengeluaran" DROP COLUMN "jenisPengeluaran",
ADD COLUMN     "jenisPengeluaran" "JenisPengeluaran" NOT NULL DEFAULT 'HARIAN';
