import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
    try {
        const dealers = await prisma.dealer.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            include: {
                batches: {
                    orderBy: { openedAt: 'desc' },
                    include: {
                        washes: {
                            select: { id: true, price: true, serviceName: true, comments: true, senderName: true, createdAt: true }
                        }
                    }
                }
            }
        });
        return NextResponse.json(dealers);
    } catch (error) {
        console.error('Failed to fetch dealers:', error);
        return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, services } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Dealer name is required' }, { status: 400 });
        }
        if (!Array.isArray(services) || services.length === 0) {
            return NextResponse.json({ error: 'At least one service is required' }, { status: 400 });
        }

        const dealer = await prisma.dealer.create({
            data: { name: name.trim(), services }
        });
        return NextResponse.json(dealer);
    } catch (error) {
        console.error('Failed to create dealer:', error);
        return NextResponse.json({ error: 'Failed to create dealer' }, { status: 500 });
    }
}
