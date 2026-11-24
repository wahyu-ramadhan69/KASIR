-- CreateTable
CREATE TABLE "PermintaanEditPenjualan" (
    "id" SERIAL NOT NULL,
    "penjualanId" INTEGER NOT NULL,
    "diajukanOlehId" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "snapshotSebelum" JSONB NOT NULL,
    "status" "StatusApproval" NOT NULL DEFAULT 'PENDING',
    "diprosesOlehId" INTEGER,
    "diprosesAt" TIMESTAMP(3),
    "catatanAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermintaanEditPenjualan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermintaanEditPenjualan_status_idx" ON "PermintaanEditPenjualan"("status");

-- CreateIndex
CREATE INDEX "PermintaanEditPenjualan_penjualanId_idx" ON "PermintaanEditPenjualan"("penjualanId");

-- AddForeignKey
ALTER TABLE "PermintaanEditPenjualan" ADD CONSTRAINT "PermintaanEditPenjualan_penjualanId_fkey" FOREIGN KEY ("penjualanId") REFERENCES "PenjualanHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanEditPenjualan" ADD CONSTRAINT "PermintaanEditPenjualan_diajukanOlehId_fkey" FOREIGN KEY ("diajukanOlehId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermintaanEditPenjualan" ADD CONSTRAINT "PermintaanEditPenjualan_diprosesOlehId_fkey" FOREIGN KEY ("diprosesOlehId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
