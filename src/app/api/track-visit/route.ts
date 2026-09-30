import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const path = body.path || '/';
    const visitorId = body.visitorId || null;

    // Do not count admin dashboard or API route visits
    if (path.startsWith('/admin') || path.startsWith('/api')) {
      return NextResponse.json({ success: true, ignored: true });
    }

    // Optional user session ID if logged in
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const userId = (token?.id as string) || (token?.sub as string) || null;
    const userAgent = req.headers.get('user-agent') || null;

    await prisma.pageView.create({
      data: {
        path,
        visitorId,
        userId,
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Fail silently so page loading is never blocked
    console.error('Track visit error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
