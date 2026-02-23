import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const params = await Promise.resolve(context.params);
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await request.json();

        // Allowed fields for manual update
        const updateData: any = {};
        if (body.checkIn) updateData.checkIn = new Date(body.checkIn);
        if (body.checkOut !== undefined) updateData.checkOut = body.checkOut ? new Date(body.checkOut) : null;
        if (body.breakHours !== undefined) updateData.breakHours = parseFloat(body.breakHours);
        if (body.tips !== undefined) updateData.tips = parseFloat(body.tips);

        // Recalculate totalHours if both checkIn and checkOut exist
        if (body.checkOut || body.checkIn || body.breakHours !== undefined) {
            const currentTimeEntry = await prisma.timeEntry.findUnique({ where: { id } });
            if (currentTimeEntry) {
                const inTime = updateData.checkIn || currentTimeEntry.checkIn;
                const outTime = updateData.checkOut !== undefined ? updateData.checkOut : currentTimeEntry.checkOut;
                const breaks = updateData.breakHours !== undefined ? updateData.breakHours : currentTimeEntry.breakHours;

                if (outTime) {
                    const diffMs = outTime.getTime() - inTime.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);
                    updateData.totalHours = diffHours - breaks;
                } else {
                    updateData.totalHours = null;
                }
            }
        }

        const entry = await prisma.timeEntry.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(entry);
    } catch (error) {
        console.error('Failed to update time entry:', error);
        return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        const params = await Promise.resolve(context.params);
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await prisma.timeEntry.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete time entry:', error);
        return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
    }
}
