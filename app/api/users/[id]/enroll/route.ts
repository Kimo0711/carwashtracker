import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const ENROLL_MINUTES = 15;

// POST /api/users/[id]/enroll — one-time code the employee opens on their phone to link it
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const code = randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + ENROLL_MINUTES * 60 * 1000);

        await prisma.user.update({
            where: { id },
            data: { enrollCode: code, enrollExpiresAt: expiresAt },
        });

        return NextResponse.json({ code, expiresAt });
    } catch (error) {
        console.error('Failed to create phone link:', error);
        return NextResponse.json({ error: 'Failed to create phone link' }, { status: 500 });
    }
}

// DELETE /api/users/[id]/enroll — unlink the employee's phone
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await prisma.user.update({
            where: { id },
            data: { clockToken: null, enrollCode: null, enrollExpiresAt: null },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to unlink phone:', error);
        return NextResponse.json({ error: 'Failed to unlink phone' }, { status: 500 });
    }
}
