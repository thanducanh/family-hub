import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const corsMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const corsHeaders = 'Content-Type, Authorization, X-Requested-With';
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const databaseOfflineBody = {
  ok: false,
  code: 'DATABASE_OFFLINE',
  message: 'Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.',
};

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', corsMethods);
  response.headers.set('Access-Control-Allow-Headers', corsHeaders);
  return response;
}

export async function proxy(request: NextRequest) {
  // 1. Handle OPTIONS (Preflight)
  if (request.method === 'OPTIONS') {
    return withCors(new NextResponse(null, { status: 204 }));
  }

  const path = request.nextUrl.pathname;
  if (writeMethods.has(request.method) && path !== '/api/health/db') {
    try {
      const healthUrl = new URL('/api/health/db', request.url);
      const health = await fetch(healthUrl, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      if (!health.ok) {
        return withCors(NextResponse.json(databaseOfflineBody, { status: 503 }));
      }
    } catch {
      return withCors(NextResponse.json(databaseOfflineBody, { status: 503 }));
    }
  }

  // 2. Handle actual request - Just set CORS headers on the request/response flow
  return withCors(NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
