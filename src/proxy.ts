import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    pathname === '/' ||
    pathname.startsWith('/guide') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/offline') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html';

  if (isPublicPath) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.getAll().some(
    (cookie) => cookie.name.includes('-auth-token') && cookie.value
  );

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
