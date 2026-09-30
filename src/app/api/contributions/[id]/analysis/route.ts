import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateContributorAnalysisEdit, getOrCreateCaseStudyAnalysis } from '@/lib/ai/case-study-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contributionId = params.id;
    const analysis = await getOrCreateCaseStudyAnalysis(contributionId);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Case study analysis not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error('❌ Case Study Analysis GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch case study analysis.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const success = await updateContributorAnalysisEdit(
      contributionId,
      session.user.id,
      body
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You can only edit analysis for your own verified contributions.' },
        { status: 403 }
      );
    }

    const updatedAnalysis = await getOrCreateCaseStudyAnalysis(contributionId);

    return NextResponse.json({
      success: true,
      message: 'Case study analysis updated successfully.',
      analysis: updatedAnalysis,
    });
  } catch (error: any) {
    console.error('❌ Case Study Analysis PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update case study analysis.' },
      { status: 500 }
    );
  }
}
