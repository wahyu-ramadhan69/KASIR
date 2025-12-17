/*
  Warnings:

  - Added the required column `jumlahDibawa` to the `ManifestBarang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Step 1: Add column jumlahDibawa dengan default 0 terlebih dahulu
ALTER TABLE "ManifestBarang" ADD COLUMN "jumlahDibawa" BIGINT NOT NULL DEFAULT 0;

-- Step 2: Copy nilai totalItem ke jumlahDibawa + jumlahTerjual + jumlahKembali (restore jumlah awal)
UPDATE "ManifestBarang"
SET "jumlahDibawa" = "totalItem" + "jumlahTerjual" + "jumlahKembali";

-- Step 3: Hapus default value (agar ke depannya tidak auto 0)
ALTER TABLE "ManifestBarang" ALTER COLUMN "jumlahDibawa" DROP DEFAULT;
