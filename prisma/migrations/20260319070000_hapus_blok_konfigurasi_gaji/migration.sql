-- Hapus kolom blokWaktuMenit
ALTER TABLE "KonfigurasiGaji" DROP COLUMN IF EXISTS "blokWaktuMenit";

-- Rename kolom potonganTelatPerBlok -> potonganTelat
ALTER TABLE "KonfigurasiGaji" RENAME COLUMN "potonganTelatPerBlok" TO "potonganTelat";

-- Rename kolom potonganKurangJamPerBlok -> potonganKurangJam
ALTER TABLE "KonfigurasiGaji" RENAME COLUMN "potonganKurangJamPerBlok" TO "potonganKurangJam";
