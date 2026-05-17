import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathString = path.join('/');
  const url = new URL(`http://janazapro.com:8080/geoserver/${pathString}`);
  
  // Copy query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('Geoserver proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy geoserver request' },
      { status: 504 }
    );
  }
}
