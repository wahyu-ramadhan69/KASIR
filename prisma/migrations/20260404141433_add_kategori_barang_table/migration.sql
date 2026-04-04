/*
  Warnings:

  - You are about to drop the column `kategori` on the `Barang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Barang" DROP COLUMN "kategori",
ADD COLUMN     "kategoriId" INTEGER;

-- CreateTable
CREATE TABLE "KategoriBarang" (
    "id" SERIAL NOT NULL,
    "namaKategori" TEXT NOT NULL,
    "deskripsi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KategoriBarang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KategoriBarang_namaKategori_key" ON "KategoriBarang"("namaKategori");

-- AddForeignKey
ALTER TABLE "Barang" ADD CONSTRAINT "Barang_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "KategoriBarang"("id") ON DELETE SET NULL ON UPDATE CASCADE;
