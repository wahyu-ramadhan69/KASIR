-- CreateTable
CREATE TABLE "StokHarian" (
    "id" SERIAL NOT NULL,
    "barangId" INTEGER NOT NULL,
    "tanggal" DATE NOT NULL,
    "stok" BIGINT NOT NULL,
    "totalMasuk" BIGINT NOT NULL DEFAULT 0,
    "totalKeluar" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokHarian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StokHarian_tanggal_idx" ON "StokHarian"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "StokHarian_barangId_tanggal_key" ON "StokHarian"("barangId", "tanggal");

-- AddForeignKey
ALTER TABLE "StokHarian" ADD CONSTRAINT "StokHarian_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
