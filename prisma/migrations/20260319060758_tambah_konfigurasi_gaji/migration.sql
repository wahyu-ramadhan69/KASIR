-- CreateTable
CREATE TABLE "KonfigurasiGaji" (
    "id" SERIAL NOT NULL,
    "jamMasukBatas" TEXT NOT NULL DEFAULT '08:10',
    "jamKerjaMenit" INTEGER NOT NULL DEFAULT 540,
    "blokWaktuMenit" INTEGER NOT NULL DEFAULT 10,
    "potonganTelatPerBlok" INTEGER NOT NULL DEFAULT 10000,
    "potonganKurangJamPerBlok" INTEGER NOT NULL DEFAULT 10000,
    "upahLemburPerJam" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KonfigurasiGaji_pkey" PRIMARY KEY ("id")
);
