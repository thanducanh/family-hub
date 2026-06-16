import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const defaultAllowedOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://192.168.1.104:8081',
  'http://192.168.1.104:19006',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export function middleware(request: NextRequest) {
  // Get the origin from the request
  const origin = request.headers.get('origin') || '';

  // Parse env origins
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];
    
  const allAllowedOrigins = [...defaultAllowedOrigins, ...envOrigins];

  // Check if the origin is in our allowed list
  // If no origin is provided (e.g. server-to-server fetch), we still allow it but don't set CORS headers
  const isAllowedOrigin = origin && allAllowedOrigins.includes(origin);

  // 1. Handle OPTIONS (Preflight)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Vary', 'Origin');
    
    return response;
  }

  // 2. Handle actual request (GET, POST, PUT, DELETE, PATCH)
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Vary', 'Origin');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
