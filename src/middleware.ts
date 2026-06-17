import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const corsMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const corsHeaders = 'Content-Type, Authorization, X-Requested-With';

export function middleware(request: NextRequest) {
  // 1. Handle OPTIONS (Preflight)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', corsMethods);
    response.headers.set('Access-Control-Allow-Headers', corsHeaders);
    return response;
  }

  // 2. Handle actual request - Just set CORS headers on the request/response flow
  // Vercel and Next.js 14+ will merge these headers into the final response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', corsMethods);
  response.headers.set('Access-Control-Allow-Headers', corsHeaders);

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
