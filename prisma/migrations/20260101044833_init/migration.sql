-- AlterTable
ALTER TABLE "PembayaranPenjualan" ADD COLUMN     "totalCash" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "totalTransfer" BIGINT NOT NULL DEFAULT 0;
