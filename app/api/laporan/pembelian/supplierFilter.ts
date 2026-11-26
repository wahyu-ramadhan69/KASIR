// Filter supplier (bisa lebih dari satu) untuk laporan pembelian.
// Query: supplierIds=1,2,3  (supplierId=1 lama tetap didukung)

export function parseSupplierIds(searchParams: URLSearchParams): number[] {
  const raw = [
    searchParams.get("supplierIds") || "",
    searchParams.get("supplierId") || "",
  ].join(",");

  const ids = raw
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => Number.isInteger(v) && v > 0);

  return Array.from(new Set(ids));
}

/** Kondisi Prisma untuk PembelianHeader.supplierId (undefined = semua) */
export function supplierWhere(supplierIds: number[]) {
  if (supplierIds.length === 0) return undefined;
  if (supplierIds.length === 1) return supplierIds[0];
  return { in: supplierIds };
}
