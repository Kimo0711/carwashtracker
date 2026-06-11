import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);
        const body = await request.json();
        const { name, services } = body;

        const dealer = await prisma.dealer.update({
            where: { id },
            data: { name: name.trim(), services }
        });
        return NextResponse.json(dealer);
    } catch (error) {
        console.error('Failed to update dealer:', error);
        return NextResponse.json({ error: 'Failed to update dealer' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);

        await prisma.dealer.update({
            where: { id },
            data: { isActive: false }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete dealer:', error);
        return NextResponse.json({ error: 'Failed to delete dealer' }, { status: 500 });
    }
}
