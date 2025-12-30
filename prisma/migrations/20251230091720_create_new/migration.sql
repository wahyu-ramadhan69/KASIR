-- CreateTable
CREATE TABLE "PembayaranPenjualan" (
    "id" SERIAL NOT NULL,
    "kodePembayaran" TEXT NOT NULL,
    "penjualanId" INTEGER NOT NULL,
    "tanggalBayar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nominal" BIGINT NOT NULL,
    "metode" "MetodePembayaran" NOT NULL DEFAULT 'CASH',
    "catatan" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PembayaranPenjualan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PembayaranPenjualan_kodePembayaran_key" ON "PembayaranPenjualan"("kodePembayaran");

-- CreateIndex
CREATE INDEX "PembayaranPenjualan_penjualanId_idx" ON "PembayaranPenjualan"("penjualanId");

-- CreateIndex
CREATE INDEX "PembayaranPenjualan_tanggalBayar_idx" ON "PembayaranPenjualan"("tanggalBayar");

-- AddForeignKey
ALTER TABLE "PembayaranPenjualan" ADD CONSTRAINT "PembayaranPenjualan_penjualanId_fkey" FOREIGN KEY ("penjualanId") REFERENCES "PenjualanHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
