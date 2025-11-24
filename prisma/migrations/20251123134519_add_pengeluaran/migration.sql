-- CreateEnum
CREATE TYPE "JenisPengeluaran" AS ENUM ('BAHAN_BAKAR', 'UPAH_KULI', 'LAINNYA');

-- CreateTable
CREATE TABLE "Pengeluaran" (
    "id" SERIAL NOT NULL,
    "jenis" "JenisPengeluaran" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "keterangan" TEXT,
    "tanggalInput" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Pengeluaran_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Pengeluaran" ADD CONSTRAINT "Pengeluaran_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
