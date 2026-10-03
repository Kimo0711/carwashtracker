import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { CLOCK_COOKIE, clientIp, shopLocation, verifyPresence } from '../../../lib/checkin';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// The employee is whoever this phone was linked to — never taken from the request body
async function linkedUser(request: NextRequest) {
  const token = request.cookies.get(CLOCK_COOKIE)?.value;
  if (!token) return null;
  return prisma.user.findUnique({ where: { clockToken: token } });
}

// GET /api/clock — who this phone is linked to, and their current open entry if any
export async function GET(request: NextRequest) {
  try {
    const user = await linkedUser(request);
    if (!user) {
      return NextResponse.json({ linked: false });
    }

    const openEntry = await prisma.timeEntry.findFirst({
      where: { userId: user.id, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    return NextResponse.json({
      linked: true,
      username: user.username,
      clockedIn: !!openEntry,
      checkIn: openEntry?.checkIn ?? null,
    });
  } catch (error) {
    console.error('Clock status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

// POST /api/clock — clock in or out
export async function POST(request: NextRequest) {
  try {
    const user = await linkedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'This phone is not linked to an employee.' }, { status: 401 });
    }

    const { lat, lng } = await request.json().catch(() => ({}));

    // Presence check — the phone must be on the shop Wi-Fi or within range of the shop
    const shop = shopLocation(await prisma.shopSettings.findUnique({ where: { id: 1 } }));
    const presence = verifyPresence(shop, clientIp(request), lat, lng);
    if ('error' in presence) {
      return NextResponse.json(presence, { status: 403 });
    }

    const openEntry = await prisma.timeEntry.findFirst({
      where: { userId: user.id, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    if (openEntry) {
      const now = new Date();
      const diffMs = now.getTime() - openEntry.checkIn.getTime();
      const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      const entry = await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { checkOut: now, totalHours, checkOutVia: presence.via },
      });

      return NextResponse.json({ action: 'out', entry });
    } else {
      const entry = await prisma.timeEntry.create({
        data: { userId: user.id, checkIn: new Date(), breakHours: 0, checkInVia: presence.via },
      });

      return NextResponse.json({ action: 'in', entry });
    }
  } catch (error) {
    console.error('Clock error:', error);
    return NextResponse.json({ error: 'Failed to clock in/out' }, { status: 500 });
  }
}
