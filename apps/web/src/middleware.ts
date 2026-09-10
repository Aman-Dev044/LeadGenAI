import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'la_auth';
const publicAuthPaths = ['/auth/login', '/auth/register', '/auth/verify-email', '/auth/forgot-password', '/auth/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isLoggedIn = request.cookies.get(AUTH_COOKIE)?.value === '1';

  // Protect dashboard routes on the server: no marker cookie -> straight to login
  if (pathname.startsWith('/dashboard') && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in users skip the login/register pages
  if (isLoggedIn && (pathname === '/auth/login' || pathname === '/auth/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect root to dashboard or login
  if (pathname === '/') {
    return NextResponse.redirect(new URL(isLoggedIn ? '/dashboard' : '/auth/login', request.url));
  }

  // Security headers for all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

// Exported for reference in tests/docs
export { publicAuthPaths };
