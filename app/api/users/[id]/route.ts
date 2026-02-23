import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
    try {
        // Next.js 15 requires awaiting dynamic route params in route handlers
        // To be safe and compatible with 14/15, we resolve the params object
        const params = await Promise.resolve(context.params);
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const user = await prisma.user.delete({
            where: { id },
        });

        // Also delete any pending sessions if they had one active in telegram
        if (user) {
            await prisma.botSession.deleteMany({
                where: { chatId: user.telegramId }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
