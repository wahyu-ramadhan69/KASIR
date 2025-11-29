/*
  Warnings:

  - You are about to drop the column `jenis` on the `Pengeluaran` table. All the data in the column will be lost.
  - Added the required column `NamaPengeluaran` to the `Pengeluaran` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pengeluaran" DROP COLUMN "jenis",
ADD COLUMN     "NamaPengeluaran" TEXT NOT NULL;

-- DropEnum
DROP TYPE "JenisPengeluaran";
