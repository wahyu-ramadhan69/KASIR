-- CreateEnum
CREATE TYPE "StatusPembayaran" AS ENUM ('LUNAS', 'HUTANG');

-- CreateEnum
CREATE TYPE "StatusTransaksi" AS ENUM ('KERANJANG', 'SELESAI', 'DIBATALKAN');

-- CreateTable
CREATE TABLE "PembelianHeader" (
    "id" SERIAL NOT NULL,
    "kodePembelian" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "diskonNota" INTEGER NOT NULL DEFAULT 0,
    "totalHarga" INTEGER NOT NULL DEFAULT 0,
    "jumlahDibayar" INTEGER NOT NULL DEFAULT 0,
    "statusPembayaran" "StatusPembayaran" NOT NULL DEFAULT 'HUTANG',
    "statusTransaksi" "StatusTransaksi" NOT NULL DEFAULT 'KERANJANG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PembelianHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PembelianItem" (
    "id" SERIAL NOT NULL,
    "pembelianId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "jumlahDus" INTEGER NOT NULL DEFAULT 0,
    "hargaPokok" INTEGER NOT NULL,
    "diskonPerItem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PembelianItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PembelianHeader_kodePembelian_key" ON "PembelianHeader"("kodePembelian");

-- AddForeignKey
ALTER TABLE "PembelianHeader" ADD CONSTRAINT "PembelianHeader_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PembelianItem" ADD CONSTRAINT "PembelianItem_pembelianId_fkey" FOREIGN KEY ("pembelianId") REFERENCES "PembelianHeader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PembelianItem" ADD CONSTRAINT "PembelianItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
