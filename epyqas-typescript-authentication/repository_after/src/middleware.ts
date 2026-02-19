import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/auth/session';

// List of routes that require authentication
const protectedRoutes = ['/dashboard'];
// List of routes that should be inaccessible to authenticated users
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const path = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some(route => path.startsWith(route));
  const isAuthRoute = authRoutes.some(route => path.startsWith(route));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
  runtime: 'nodejs',
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
