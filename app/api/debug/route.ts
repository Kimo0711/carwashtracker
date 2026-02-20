import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        deployed: true,
        timestamp: new Date().toISOString(),
        build_id: 'debug-check-1'
    });
}
