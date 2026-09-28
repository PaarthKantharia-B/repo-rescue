import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendFounderFeedbackEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    // 1. Independent Server-Side Authentication Enforcement (401 if missing)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be signed in with GitHub to send a message to the founder.' },
        { status: 401 }
      );
    }

    // 2. IP & Rate limiting protection
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimit = checkRateLimit(`founder_feedback_${ip}`, 5, 60 * 60 * 1000); // Max 5 submissions per hour

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many messages sent. Please wait a while before sending another message to the founder.' },
        { status: 429 }
      );
    }

    // 3. Parse request payload
    const body = await req.json();
    const { category, email, message, website_url } = body;

    // 4. Honeypot check (bot prevention)
    if (website_url && typeof website_url === 'string' && website_url.trim().length > 0) {
      return NextResponse.json({ success: true, message: 'Message received.' });
    }

    // 5. Validate Message (Required)
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter a message before submitting." },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 5) {
      return NextResponse.json(
        { error: "Your message is a bit too short. Please add a few more details." },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 5000) {
      return NextResponse.json(
        { error: "Message exceeds maximum allowed length of 5,000 characters." },
        { status: 400 }
      );
    }

    // 6. Validate Email (Optional)
    let validatedEmail: string | undefined = undefined;
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const trimmedEmail = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return NextResponse.json(
          { error: "Please enter a valid email address, or leave it blank to stay anonymous." },
          { status: 400 }
        );
      }
      // Sanitize header injection attempts
      validatedEmail = trimmedEmail.replace(/[\r\n]/g, '');
    }

    // 7. Validate Category (Optional)
    let sanitizedCategory: string | undefined = undefined;
    if (category && typeof category === 'string' && category.trim().length > 0) {
      sanitizedCategory = category.trim().replace(/[\r\n]/g, '');
    }

    // 8. Extract Authenticated GitHub User from Verified Session
    const githubUsername = session.user.githubUsername;

    // 9. Deliver Email Server-Side
    const emailResult = await sendFounderFeedbackEmail({
      category: sanitizedCategory,
      email: validatedEmail,
      message: trimmedMessage,
      githubUsername,
      timestamp: new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'medium',
      }) + ' (UTC)',
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Something went wrong while sending your message. Your message hasn't been sent yet. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Founder Feedback API Error]:', err);
    return NextResponse.json(
      { error: "Something went wrong while sending your message. Your message hasn't been sent yet. Please try again." },
      { status: 500 }
    );
  }
}
