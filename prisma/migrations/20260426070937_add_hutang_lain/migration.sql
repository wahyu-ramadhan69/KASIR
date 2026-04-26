-- CreateEnum
CREATE TYPE "JenisHutangLain" AS ENUM ('KENDARAAN', 'BANK', 'PERALATAN', 'BANGUNAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "StatusHutangLain" AS ENUM ('AKTIF', 'LUNAS');

-- CreateTable
CREATE TABLE "HutangLain" (
    "id" SERIAL NOT NULL,
    "namaHutang" TEXT NOT NULL,
    "jenisHutang" "JenisHutangLain" NOT NULL,
    "kreditur" TEXT NOT NULL,
    "jumlahPokok" BIGINT NOT NULL,
    "jumlahDibayar" BIGINT NOT NULL DEFAULT 0,
    "tanggalMulai" DATE NOT NULL,
    "tanggalJatuhTempo" DATE,
    "keterangan" TEXT,
    "status" "StatusHutangLain" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HutangLain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HutangLainPembayaran" (
    "id" SERIAL NOT NULL,
    "hutangLainId" INTEGER NOT NULL,
    "jumlahBayar" BIGINT NOT NULL,
    "tanggalBayar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keterangan" TEXT,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HutangLainPembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HutangLain_status_idx" ON "HutangLain"("status");

-- CreateIndex
CREATE INDEX "HutangLain_jenisHutang_idx" ON "HutangLain"("jenisHutang");

-- CreateIndex
CREATE INDEX "HutangLainPembayaran_hutangLainId_idx" ON "HutangLainPembayaran"("hutangLainId");

-- AddForeignKey
ALTER TABLE "HutangLainPembayaran" ADD CONSTRAINT "HutangLainPembayaran_hutangLainId_fkey" FOREIGN KEY ("hutangLainId") REFERENCES "HutangLain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
