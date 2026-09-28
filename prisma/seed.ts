import { PrismaClient, Role, IssueStatus, PRStatus, ContributionStatus, LedgerTransactionType } from '@prisma/client';
import { calculateRRDifficulty, calculateRRPointsFromScore, SCORING_VERSION } from '../src/lib/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Repo Rescue V1 database cleanup...');

  // Clean existing tables in reverse dependency order
  await prisma.pointsLedger.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.pullRequest.deleteMany();
  await prisma.issueScore.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log('🎉 Database cleanup complete! 0 fake records remain. Ready for production data.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
