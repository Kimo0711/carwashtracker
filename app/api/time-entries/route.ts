import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const archived = searchParams.get('archived') === 'true';

        const timeEntries = await prisma.timeEntry.findMany({
            where: { archived },
            orderBy: { checkIn: 'desc' },
            include: {
                user: {
                    select: {
                        username: true,
                        telegramId: true
                    }
                }
            }
        });
        return NextResponse.json(timeEntries);
    } catch (error) {
        console.error('Failed to fetch time entries:', error);
        return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { userId, checkIn, checkOut, breakHours, tips } = body;

        if (!userId || !checkIn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        breakHours = parseFloat(breakHours) || 0;
        tips = parseFloat(tips) || 0;

        const inTime = new Date(checkIn);
        let outTime = null;
        let totalHours = null;

        if (checkOut) {
            outTime = new Date(checkOut);
            const diffMs = outTime.getTime() - inTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            totalHours = Math.max(0, diffHours - breakHours);
        }

        const entry = await prisma.timeEntry.create({
            data: {
                userId: parseInt(userId),
                checkIn: inTime,
                checkOut: outTime,
                breakHours,
                tips,
                totalHours
            }
        });

        return NextResponse.json(entry);
    } catch (error) {
        console.error('Failed to create time entry:', error);
        return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'archive_all') {
            await prisma.timeEntry.updateMany({
                where: { archived: false },
                data: { archived: true }
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Failed to update entries:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
