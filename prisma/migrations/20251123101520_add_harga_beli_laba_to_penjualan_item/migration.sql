-- AlterTable
ALTER TABLE "PenjualanItem" ADD COLUMN     "hargaBeli" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "laba" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "jumlahDus" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "PenjualanItem_penjualanId_idx" ON "PenjualanItem"("penjualanId");

-- CreateIndex
CREATE INDEX "PenjualanItem_barangId_idx" ON "PenjualanItem"("barangId");
