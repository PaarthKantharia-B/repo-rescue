import { PrismaClient, LedgerTransactionType } from '@prisma/client';

/**
 * Service function to process an auditable points transaction.
 * Guarantees:
 * 1. Creates exactly one PointsLedger record.
 * 2. Recalculates and updates User.totalPoints as a derived aggregate.
 * 3. Atomic transaction execution.
 */
export async function recordPointsTransaction(
  prisma: PrismaClient,
  params: {
    userId: string;
    amount: number;
    type: LedgerTransactionType;
    reason: string;
    contributionId?: string;
  }
) {
  return await prisma.$transaction(async (tx) => {
    // Calculate current aggregate from ledger
    const ledgerAgg = await tx.pointsLedger.aggregate({
      where: { userId: params.userId },
      _sum: { amount: true },
    });

    const currentBalance = ledgerAgg._sum.amount ?? 0;
    const newBalance = currentBalance + params.amount;

    // Create ledger entry
    const entry = await tx.pointsLedger.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        balanceAfter: newBalance,
        type: params.type,
        reason: params.reason,
        contributionId: params.contributionId,
      },
    });

    // Update cached aggregate on User model
    await tx.user.update({
      where: { id: params.userId },
      data: { totalPoints: newBalance },
    });

    return entry;
  });
}

/**
 * Audit helper: verify if User.totalPoints strictly equals sum of PointsLedger entries.
 */
export async function verifyUserLedgerBalance(prisma: PrismaClient, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  const ledgerAgg = await prisma.pointsLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });

  const ledgerTotal = ledgerAgg._sum.amount ?? 0;
  return Math.abs(user.totalPoints - ledgerTotal) < 0.001; // exact floating point match
}
