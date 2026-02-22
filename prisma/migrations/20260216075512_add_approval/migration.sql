-- CreateEnum
CREATE TYPE "StatusApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "PenjualanHeader" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" INTEGER,
ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "statusApproval" "StatusApproval" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenjualanHeader" ADD CONSTRAINT "PenjualanHeader_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
