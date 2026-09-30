import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Resolves list of authorized admin GitHub usernames from environment variables.
 * Supports comma-separated usernames (e.g. "PaarthKantharia-B,admin2").
 */
export function getAdminUsernames(): string[] {
  const envAdmins = process.env.ADMIN_GITHUB_USERNAMES || process.env.ADMIN_USERS;
  
  if (!envAdmins || !envAdmins.trim()) {
    return [];
  }

  return envAdmins
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Evaluates whether a session belongs to an authorized administrator.
 */
export async function checkIsAdmin(session: any): Promise<boolean> {
  if (!session || !session.user) return false;

  const adminUsernames = getAdminUsernames();
  if (adminUsernames.length === 0) return false;

  let username: string | undefined = session.user.githubUsername || undefined;

  // Fallback DB query if githubUsername is missing from session object
  if (!username && session.user.id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { githubUsername: true },
      });
      username = dbUser?.githubUsername || undefined;
    } catch (error) {
      console.error('[Admin Auth DB Error]:', error);
    }
  }

  // Fallback to name if githubUsername is absent
  if (!username && session.user.name) {
    username = session.user.name;
  }

  if (!username) return false;

  return adminUsernames.includes(username.toLowerCase());
}
