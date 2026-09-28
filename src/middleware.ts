import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function sanitizeCallbackUrl(urlStr: string | null | undefined): string {
  if (!urlStr) return '/issues';
  // Open redirect prevention: strictly allow relative path starting with '/' (and not '//' or containing protocol)
  if (urlStr.startsWith('/') && !urlStr.startsWith('//') && !urlStr.includes('://')) {
    return urlStr;
  }
  return '/issues';
}

export async function middleware(req: NextRequest) {
  // Check for NextAuth JWT token across standard & secure cookie names
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const rawDestination = req.nextUrl.pathname + req.nextUrl.search;
    const safeDestination = sanitizeCallbackUrl(rawDestination);
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', safeDestination);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/issues', '/issues/:path*', '/talk-to-the-founder'],
};
