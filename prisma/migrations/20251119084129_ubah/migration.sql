/*
  Warnings:

  - You are about to drop the column `jenis` on the `JenisBarang` table. All the data in the column will be lost.
  - You are about to drop the column `namaAttribute` on the `JenisBarang` table. All the data in the column will be lost.
  - Added the required column `nama` to the `JenisBarang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JenisBarang" DROP COLUMN "jenis",
DROP COLUMN "namaAttribute",
ADD COLUMN     "nama" TEXT NOT NULL;
