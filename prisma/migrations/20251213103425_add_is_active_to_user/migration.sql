/*
  Warnings:

  - The values [PERSIAPAN] on the enum `StatusPerjalanan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusPerjalanan_new" AS ENUM ('DI_PERJALANAN', 'KEMBALI', 'SELESAI', 'DIBATALKAN');
ALTER TABLE "public"."PerjalananSales" ALTER COLUMN "statusPerjalanan" DROP DEFAULT;
ALTER TABLE "PerjalananSales" ALTER COLUMN "statusPerjalanan" TYPE "StatusPerjalanan_new" USING ("statusPerjalanan"::text::"StatusPerjalanan_new");
ALTER TYPE "StatusPerjalanan" RENAME TO "StatusPerjalanan_old";
ALTER TYPE "StatusPerjalanan_new" RENAME TO "StatusPerjalanan";
DROP TYPE "public"."StatusPerjalanan_old";
ALTER TABLE "PerjalananSales" ALTER COLUMN "statusPerjalanan" SET DEFAULT 'DI_PERJALANAN';
COMMIT;

-- AlterTable
ALTER TABLE "PerjalananSales" ALTER COLUMN "statusPerjalanan" SET DEFAULT 'DI_PERJALANAN';
