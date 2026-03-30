-- CreateEnum
CREATE TYPE "TipePengembalian" AS ENUM ('TRANSAKSI_SALES', 'TRANSAKSI_TOKO', 'BARANG_GUDANG');

-- AlterTable
ALTER TABLE "PengembalianBarang" ADD COLUMN "tipePengembalian" "TipePengembalian" NOT NULL DEFAULT 'TRANSAKSI_TOKO';
