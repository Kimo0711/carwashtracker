import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
    try {
        const timeEntries = await prisma.timeEntry.findMany({
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

        let { userId, checkIn, checkOut, breakHours } = body;

        if (!userId || !checkIn) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        breakHours = parseFloat(breakHours) || 0;

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
                totalHours
            }
        });

        return NextResponse.json(entry);
    } catch (error) {
        console.error('Failed to create time entry:', error);
        return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
    }
}
