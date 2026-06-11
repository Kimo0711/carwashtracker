import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const dealerId = parseInt(params.id);

        const openBatch = await prisma.dealerBatch.findFirst({
            where: { dealerId, status: 'OPEN' }
        });

        if (!openBatch) {
            return NextResponse.json({ error: 'No open batch found for this dealer' }, { status: 404 });
        }

        const closedBatch = await prisma.dealerBatch.update({
            where: { id: openBatch.id },
            data: { status: 'PAID', paidAt: new Date() },
            include: {
                washes: {
                    select: { id: true, price: true, serviceName: true, comments: true, senderName: true, createdAt: true }
                }
            }
        });

        return NextResponse.json(closedBatch);
    } catch (error) {
        console.error('Failed to pay batch:', error);
        return NextResponse.json({ error: 'Failed to pay batch' }, { status: 500 });
    }
}
