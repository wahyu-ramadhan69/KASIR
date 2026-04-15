/**
 * Script one-time untuk memperbaiki hargaBeli dan laba
 * pada penjualanItem yang diproses lewat approval sales.
 *
 * Jalankan: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-laba-approval.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const safe = Math.max(1, jumlahPerKemasan);
  return {
    jumlahDus: Math.floor(totalItem / safe),
    jumlahPcs: totalItem % safe,
  };
}

async function main() {
  console.log("Mencari item yang perlu diperbaiki...");

  // Ambil semua item dari penjualan yang APPROVED
  // dan hargaBeli-nya 0 (belum pernah diisi saat approval)
  const items = await prisma.penjualanItem.findMany({
    where: {
      hargaBeli: 0,
      penjualan: {
        statusApproval: "APPROVED",
      },
    },
    include: {
      barang: {
        select: {
          hargaBeli: true,
          hargaJual: true,
          jumlahPerKemasan: true,
        },
      },
    },
  });

  console.log(`Ditemukan ${items.length} item yang perlu diperbaiki.`);

  if (items.length === 0) {
    console.log("Tidak ada item yang perlu diperbaiki.");
    return;
  }

  let fixed = 0;
  let skipped = 0;

  for (const item of items) {
    const hargaBeliBarang = Number(item.barang?.hargaBeli || 0);
    if (hargaBeliBarang === 0) {
      // Barang tidak punya hargaBeli, skip
      skipped++;
      continue;
    }

    const jumlahPerKemasan = Math.max(1, Number(item.barang?.jumlahPerKemasan || 1));
    const totalPcs = Number(item.totalItem);
    const hargaJualItem = Number(item.hargaJual);
    const diskonItem = Number(item.diskonPerItem);

    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(totalPcs, jumlahPerKemasan);
    const hargaBeliPerPcs = Math.round(hargaBeliBarang / jumlahPerKemasan);
    const hargaJualPerPcs = Math.round(hargaJualItem / jumlahPerKemasan);
    const labaFromDus = (hargaJualItem - diskonItem - hargaBeliBarang) * jumlahDus;
    const labaFromPcs = (hargaJualPerPcs - hargaBeliPerPcs) * jumlahPcs;
    const totalLaba = labaFromDus + labaFromPcs;

    await prisma.penjualanItem.update({
      where: { id: item.id },
      data: {
        hargaBeli: item.barang.hargaBeli,
        laba: BigInt(totalLaba),
      },
    });

    fixed++;
  }

  console.log(`\nSelesai:`);
  console.log(`  - Diperbaiki : ${fixed} item`);
  console.log(`  - Dilewati   : ${skipped} item (hargaBeli barang = 0)`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
