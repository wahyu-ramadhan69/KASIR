-- AlterTable
ALTER TABLE "Barang" ADD COLUMN     "gambar" TEXT,
ADD COLUMN     "kategori" TEXT,
ADD COLUMN     "tampilDiHalaman" BOOLEAN NOT NULL DEFAULT false;
