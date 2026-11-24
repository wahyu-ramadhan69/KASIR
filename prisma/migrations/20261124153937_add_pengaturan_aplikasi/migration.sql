-- CreateTable
CREATE TABLE "PengaturanAplikasi" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PengaturanAplikasi_pkey" PRIMARY KEY ("key")
);
