import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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
        const { checkIn, checkOut, breakHours } = body;

        const inTime = new Date(checkIn);
        let outTime = null;
        let totalHours = null;

        const bHours = parseFloat(breakHours) || 0;

        if (checkOut) {
            outTime = new Date(checkOut);
            const diffMs = outTime.getTime() - inTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            totalHours = Math.max(0, diffHours - bHours);
        }

        const updatedEntry = await prisma.timeEntry.update({
            where: { id },
            data: {
                checkIn: inTime,
                checkOut: outTime,
                breakHours: bHours,
                totalHours: totalHours
            },
            include: {
                user: {
                    select: {
                        username: true,
                        telegramId: true
                    }
                }
            }
        });

        return NextResponse.json(updatedEntry);
    } catch (error) {
        console.error('Failed to update time entry:', error);
        return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);
        await prisma.timeEntry.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete time entry:', error);
        return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
    }
}
