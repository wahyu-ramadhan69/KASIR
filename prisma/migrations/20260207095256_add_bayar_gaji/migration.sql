-- CreateEnum
CREATE TYPE "PeriodeGaji" AS ENUM ('BULANAN', 'MINGGUAN');

-- CreateTable
CREATE TABLE "PembayaranGaji" (
    "id" SERIAL NOT NULL,
    "karyawanId" INTEGER NOT NULL,
    "periode" "PeriodeGaji" NOT NULL,
    "bulan" TEXT NOT NULL,
    "minggu" INTEGER,
    "tanggalBayar" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nominal" INTEGER NOT NULL,
    "totalGross" INTEGER NOT NULL,
    "totalPotongan" INTEGER NOT NULL,
    "potonganTidakHadir" INTEGER NOT NULL,
    "potonganTelat" INTEGER NOT NULL,
    "potonganKurangJam" INTEGER NOT NULL,
    "lembur" INTEGER NOT NULL,
    "gajiPokokBulanan" INTEGER NOT NULL,
    "tunjanganMakanBulanan" INTEGER NOT NULL,
    "catatan" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PembayaranGaji_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PembayaranGaji_karyawanId_idx" ON "PembayaranGaji"("karyawanId");

-- CreateIndex
CREATE INDEX "PembayaranGaji_bulan_idx" ON "PembayaranGaji"("bulan");

-- CreateIndex
CREATE INDEX "PembayaranGaji_periode_idx" ON "PembayaranGaji"("periode");

-- CreateIndex
CREATE UNIQUE INDEX "PembayaranGaji_karyawanId_periode_bulan_minggu_key" ON "PembayaranGaji"("karyawanId", "periode", "bulan", "minggu");

-- AddForeignKey
ALTER TABLE "PembayaranGaji" ADD CONSTRAINT "PembayaranGaji_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "Karyawan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PembayaranGaji" ADD CONSTRAINT "PembayaranGaji_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
