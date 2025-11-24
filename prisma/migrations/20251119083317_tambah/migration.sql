-- CreateTable
CREATE TABLE "Barang" (
    "id" SERIAL NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "hargaBeli" INTEGER NOT NULL,
    "hargaJual" INTEGER NOT NULL,
    "stok" INTEGER NOT NULL,
    "jenisBarangId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Barang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JenisBarang" (
    "id" SERIAL NOT NULL,
    "namaAttribute" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "satuan" TEXT NOT NULL,

    CONSTRAINT "JenisBarang_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Barang" ADD CONSTRAINT "Barang_jenisBarangId_fkey" FOREIGN KEY ("jenisBarangId") REFERENCES "JenisBarang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
