import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateContributorReflection } from '@/lib/ai/case-study-service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    const contributionId = params.id;
    const body = await req.json();
    const { learned } = body;

    if (typeof learned !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid input: "learned" string required.' },
        { status: 400 }
      );
    }

    const success = await updateContributorReflection(
      contributionId,
      session.user.id,
      learned.trim()
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You can only edit reflections for your own verified contributions.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, message: 'Reflection saved successfully.' });
  } catch (error: any) {
    console.error('❌ Reflection API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save reflection.' },
      { status: 500 }
    );
  }
}
