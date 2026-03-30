-- CreateTable: HariKerja (singleton konfigurasi hari kerja)
CREATE TABLE "HariKerja" (
    "id"     SERIAL NOT NULL,
    "senin"  BOOLEAN NOT NULL DEFAULT true,
    "selasa" BOOLEAN NOT NULL DEFAULT true,
    "rabu"   BOOLEAN NOT NULL DEFAULT true,
    "kamis"  BOOLEAN NOT NULL DEFAULT true,
    "jumat"  BOOLEAN NOT NULL DEFAULT true,
    "sabtu"  BOOLEAN NOT NULL DEFAULT true,
    "minggu" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HariKerja_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "HariKerja" ("senin","selasa","rabu","kamis","jumat","sabtu","minggu")
VALUES (true, true, true, true, true, true, false);

-- CreateTable: HariLibur (tanggal libur spesifik)
CREATE TABLE "HariLibur" (
    "id"         SERIAL NOT NULL,
    "tanggal"    TIMESTAMP(3) NOT NULL,
    "keterangan" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HariLibur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HariLibur_tanggal_key" ON "HariLibur"("tanggal");
