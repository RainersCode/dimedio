import { NextRequest, NextResponse } from 'next/server';

// Access the environment variable properly in server-side API routes
const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL || '';

export async function POST(request: NextRequest) {
  console.log('API Route called');
  console.log('N8N_WEBHOOK_URL:', N8N_WEBHOOK_URL);
  console.log('Environment variables available:', {
    NEXT_PUBLIC_N8N_WEBHOOK_URL: process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL
  });

  if (!N8N_WEBHOOK_URL) {
    console.error('n8n webhook URL not configured');
    return NextResponse.json(
      { error: 'n8n webhook URL not configured' }, 
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    console.log('Proxying request to n8n:', N8N_WEBHOOK_URL);
    console.log('Request payload:', body);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('n8n response status:', response.status);
    console.log('n8n response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('n8n error response:', errorText);
      throw new Error(`n8n request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const responseText = await response.text();
    console.log('n8n raw response text:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('n8n parsed response data:', data);
    } catch (parseError) {
      console.error('Failed to parse n8n response as JSON:', parseError);
      console.error('Response text was:', responseText);
      throw new Error('n8n returned invalid JSON');
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error details:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}