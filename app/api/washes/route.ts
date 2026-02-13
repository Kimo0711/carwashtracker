import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const washes = await prisma.wash.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
        return NextResponse.json(washes);
    } catch (error) {
        console.error('Error fetching washes:', error);
        return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
    }
}
