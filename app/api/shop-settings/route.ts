import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { shopLocation } from '../../../lib/checkin';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// GET /api/shop-settings — where employees must be to clock in/out
export async function GET() {
    try {
        return NextResponse.json(shopLocation(await prisma.shopSettings.findUnique({ where: { id: 1 } })));
    } catch (error) {
        console.error('Failed to fetch shop settings:', error);
        return NextResponse.json({ error: 'Failed to fetch shop settings' }, { status: 500 });
    }
}

// PUT /api/shop-settings — { lat, lng }
export async function PUT(request: Request) {
    try {
        const { lat, lng } = await request.json();
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return NextResponse.json({ error: 'Missing location' }, { status: 400 });
        }

        const saved = await prisma.shopSettings.upsert({
            where: { id: 1 },
            update: { lat, lng },
            create: { id: 1, lat, lng },
        });

        return NextResponse.json(shopLocation(saved));
    } catch (error) {
        console.error('Failed to update shop settings:', error);
        return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
    }
}
