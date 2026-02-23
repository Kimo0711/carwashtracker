import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                telegramId: true,
                username: true,
                role: true,
                createdAt: true,
            }
        });
        return NextResponse.json(users);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        let body: any = {};
        try {
            const text = await request.text();
            if (text) {
                body = JSON.parse(text);
            }
        } catch (e) {
            console.error('Error parsing body', e);
        }

        const { username, telegramId, mode } = body;

        // Mode for manual employee creation
        if (mode === 'manual') {
            if (!username) {
                return NextResponse.json({ error: 'Username is required' }, { status: 400 });
            }

            // Check if user already exists
            const existingUser = await prisma.user.findFirst({
                where: { username }
            });

            if (existingUser) {
                return NextResponse.json({ error: 'User with this name already exists' }, { status: 400 });
            }

            const newUser = await prisma.user.create({
                data: {
                    username,
                    role: 'EMPLOYEE',
                    telegramId: telegramId || null
                }
            });

            return NextResponse.json(newUser);
        }

        // Existing Invite Link logic (for mode !== 'manual' or no body)
        const crypto = require('crypto');
        const token = crypto.randomBytes(16).toString('hex');

        const inviteToken = await prisma.inviteToken.create({
            data: {
                token,
                createdBy: 'DASHBOARD_ADMIN'
            }
        });

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        let botUsername = 'your_bot';
        if (botToken) {
            try {
                // We should ideally cache this, but for now we fetch it
                const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
                const data = await res.json();
                if (data.ok) {
                    botUsername = data.result.username;
                }
            } catch (e) {
                console.error('Error fetching bot username', e);
            }
        }

        const inviteLink = `https://t.me/${botUsername}?start=invite_${inviteToken.token}`;

        return NextResponse.json({ success: true, link: inviteLink });
    } catch (error) {
        console.error('Failed to process user request:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
