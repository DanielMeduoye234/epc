import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail closed in production: cron jobs must send CRON_SECRET.
 * Vercel Cron automatically sends Authorization: Bearer <CRON_SECRET>
 * when that env var is set.
 */
export function authorizeCron(request: NextRequest | Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  const isPlaceholder = !secret || secret === 'your-cron-secret-here';

  if (isPlaceholder) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured. Refusing to run.' },
        { status: 503 }
      );
    }
    return null;
  }

  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  const querySecret = url.searchParams.get('secret');
  const authorized =
    authHeader === `Bearer ${secret}` || headerSecret === secret || querySecret === secret;

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
