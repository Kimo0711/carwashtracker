import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { CLOCK_COOKIE } from '../../../../lib/checkin';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// POST /api/clock/enroll — trade a one-time code from the dashboard for this phone's token
export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (typeof code !== 'string' || !code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    // Claiming the code and replacing the token in one step makes the code single-use
    // and unlinks whichever phone the employee had before.
    const token = randomBytes(32).toString('hex');
    const claimed = await prisma.user.updateMany({
      where: { enrollCode: code, enrollExpiresAt: { gt: new Date() } },
      data: { clockToken: token, enrollCode: null, enrollExpiresAt: null },
    });

    if (claimed.count !== 1) {
      return NextResponse.json(
        { error: 'This link has expired or was already used. Ask the owner for a new one.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { clockToken: token } });
    const res = NextResponse.json({ username: user?.username ?? '' });
    res.cookies.set(CLOCK_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (error) {
    console.error('Enroll error:', error);
    return NextResponse.json({ error: 'Failed to link this phone' }, { status: 500 });
  }
}
