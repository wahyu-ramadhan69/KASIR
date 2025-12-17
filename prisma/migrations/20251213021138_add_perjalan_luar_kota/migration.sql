-- CreateEnum
CREATE TYPE "StatusPerjalanan" AS ENUM ('PERSIAPAN', 'BERANGKAT', 'DI_PERJALANAN', 'KEMBALI', 'SELESAI', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "KondisiBarang" AS ENUM ('BAIK', 'RUSAK', 'KADALUARSA');

-- AlterTable
ALTER TABLE "PenjualanHeader" ADD COLUMN     "perjalananSalesId" INTEGER;

-- CreateTable
CREATE TABLE "PerjalananSales" (
    "id" SERIAL NOT NULL,
    "kodePerjalanan" TEXT NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "kotaTujuan" TEXT NOT NULL,
    "tanggalBerangkat" TIMESTAMP(3) NOT NULL,
    "tanggalKembali" TIMESTAMP(3),
    "statusPerjalanan" "StatusPerjalanan" NOT NULL DEFAULT 'PERSIAPAN',
    "keterangan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "PerjalananSales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestBarang" (
    "id" SERIAL NOT NULL,
    "perjalananId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "jumlahDus" BIGINT NOT NULL,
    "jumlahPcs" BIGINT NOT NULL,
    "totalItem" BIGINT NOT NULL,
    "jumlahTerjual" BIGINT NOT NULL DEFAULT 0,
    "jumlahKembali" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManifestBarang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PengembalianBarang" (
    "id" SERIAL NOT NULL,
    "perjalananId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "jumlahDus" BIGINT NOT NULL,
    "jumlahPcs" BIGINT NOT NULL,
    "kondisiBarang" "KondisiBarang" NOT NULL DEFAULT 'BAIK',
    "keterangan" TEXT,
    "tanggalPengembalian" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PengembalianBarang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerjalananSales_kodePerjalanan_key" ON "PerjalananSales"("kodePerjalanan");

-- CreateIndex
CREATE INDEX "PerjalananSales_karyawanId_idx" ON "PerjalananSales"("karyawanId");

-- CreateIndex
CREATE INDEX "PerjalananSales_statusPerjalanan_idx" ON "PerjalananSales"("statusPerjalanan");

-- CreateIndex
CREATE INDEX "ManifestBarang_perjalananId_idx" ON "ManifestBarang"("perjalananId");

-- CreateIndex
CREATE INDEX "ManifestBarang_barangId_idx" ON "ManifestBarang"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "ManifestBarang_perjalananId_barangId_key" ON "ManifestBarang"("perjalananId", "barangId");

-- CreateIndex
CREATE INDEX "PengembalianBarang_perjalananId_idx" ON "PengembalianBarang"("perjalananId");

-- CreateIndex
CREATE INDEX "PengembalianBarang_barangId_idx" ON "PengembalianBarang"("barangId");

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_perjalananSalesId_fkey" FOREIGN KEY ("perjalananSalesId") REFERENCES "PerjalananSales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerjalananSales" ADD CONSTRAINT "PerjalananSales_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestBarang" ADD CONSTRAINT "ManifestBarang_perjalananId_fkey" FOREIGN KEY ("perjalananId") REFERENCES "PerjalananSales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestBarang" ADD CONSTRAINT "ManifestBarang_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengembalianBarang" ADD CONSTRAINT "PengembalianBarang_perjalananId_fkey" FOREIGN KEY ("perjalananId") REFERENCES "PerjalananSales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengembalianBarang" ADD CONSTRAINT "PengembalianBarang_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
