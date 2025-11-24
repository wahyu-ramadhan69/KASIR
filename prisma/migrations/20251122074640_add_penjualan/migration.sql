-- CreateEnum
CREATE TYPE "MetodePembayaran" AS ENUM ('CASH', 'TRANSFER');

-- CreateTable
CREATE TABLE "PenjualanHeader" (
    "id" SERIAL NOT NULL,
    "kodePenjualan" TEXT NOT NULL,
    "customerId" INTEGER,
    "namaCustomer" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "diskonNota" INTEGER NOT NULL DEFAULT 0,
    "totalHarga" INTEGER NOT NULL DEFAULT 0,
    "jumlahDibayar" INTEGER NOT NULL DEFAULT 0,
    "kembalian" INTEGER NOT NULL DEFAULT 0,
    "metodePembayaran" "MetodePembayaran" NOT NULL DEFAULT 'CASH',
    "statusPembayaran" "StatusPembayaran" NOT NULL DEFAULT 'HUTANG',
    "statusTransaksi" "StatusTransaksi" NOT NULL DEFAULT 'KERANJANG',
    "tanggalTransaksi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tanggalJatuhTempo" TIMESTAMP(3),
    "userId" INTEGER,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenjualanHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenjualanItem" (
    "id" SERIAL NOT NULL,
    "penjualanId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "jumlahDus" INTEGER NOT NULL DEFAULT 1,
    "jumlahPcs" INTEGER NOT NULL DEFAULT 0,
    "hargaJual" INTEGER NOT NULL,
    "diskonPerItem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenjualanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PenjualanHeader_kodePenjualan_key" ON "PenjualanHeader"("kodePenjualan");

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenjualanItem" ADD CONSTRAINT "PenjualanItem_penjualanId_fkey" FOREIGN KEY ("penjualanId") REFERENCES "PenjualanHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenjualanItem" ADD CONSTRAINT "PenjualanItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
