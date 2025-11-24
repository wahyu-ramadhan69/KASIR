/*
  Warnings:

  - Added the required column `supplierId` to the `Barang` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Barang" ADD COLUMN     "supplierId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "namaSupplier" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "noHp" TEXT NOT NULL,
    "limitHutang" INTEGER NOT NULL,
    "limitPembelian" INTEGER NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Barang" ADD CONSTRAINT "Barang_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
