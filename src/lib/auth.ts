import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

import { syncContributorGithubActivity } from '@/lib/contributors/sync-service';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubUsername: profile.login,
          bio: profile.bio,
          location: profile.location,
          company: profile.company,
          websiteUrl: profile.blog,
          role: 'CONTRIBUTOR',
          totalPoints: 0,
          rrRating: 1200,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user && user.id) {
        // Fire-and-forget background contributor sync without blocking OAuth login response
        syncContributorGithubActivity(user.id).catch((err) => {
          console.error('[NextAuth events.signIn] Background contributor sync error:', err);
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      if (profile) {
        token.githubUsername = (profile as any).login;
      }
      if (user) {
        token.id = user.id;
        if ((user as any).githubUsername) {
          token.githubUsername = (user as any).githubUsername;
        }
      }
      if (!token.id && token.sub) {
        token.id = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        const userId = (token.id as string) || (token.sub as string);
        const githubUsername = (token.githubUsername as string) || session.user.name || 'contributor';

        session.user.id = userId;
        session.user.githubUsername = githubUsername;

        if (userId) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { totalPoints: true, rrRating: true, githubUsername: true, email: true },
            });
            if (dbUser) {
              if (dbUser.githubUsername) session.user.githubUsername = dbUser.githubUsername;
              session.user.totalPoints = dbUser.totalPoints ?? 0;
              session.user.rrRating = dbUser.rrRating ?? 1200;
              if (dbUser.email) session.user.email = dbUser.email;
            }
          } catch (error) {
            console.error('[NextAuth Session DB Error]:', error);
          }
        }
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET || 'repo-rescue-v1-super-secret-key-2026',
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubUsername: string;
      totalPoints: number;
      rrRating: number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    githubUsername?: string;
  }
}

