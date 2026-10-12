import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'meg-lab_session';

/**
 * Protect the authenticated application shell.
 *
 * Frontend visibility is a usability measure, not a substitute for server-side
 * authorisation: every API call is also authorised by the backend.
 */
export const proxy = (request: NextRequest) => {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
};

export const config = {
  matcher: ['/app/:path*'],
};
