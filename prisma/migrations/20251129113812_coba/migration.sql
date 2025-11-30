-- AlterTable
ALTER TABLE "PenjualanHeader" ADD COLUMN     "namaSales" TEXT,
ADD COLUMN     "salesId" INTEGER;

-- CreateTable
CREATE TABLE "Sales" (
    "id" SERIAL NOT NULL,
    "namaSupplier" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "noHp" TEXT NOT NULL,
    "limitHutang" BIGINT NOT NULL,
    "hutang" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sales_nik_key" ON "Sales"("nik");

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "Sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
