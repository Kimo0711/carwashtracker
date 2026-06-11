import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { distanceMeters } from '../../../lib/checkin';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// GET /api/clock?userId=X — returns current open entry if any
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '');

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
    }

    const openEntry = await prisma.timeEntry.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    return NextResponse.json({ clockedIn: !!openEntry, checkIn: openEntry?.checkIn ?? null });
  } catch (error) {
    console.error('Clock status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

// POST /api/clock — clock in or out
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, lat, lng } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Location check — enforced when SHOP_LAT and SHOP_LNG are configured
    const shopLat = parseFloat(process.env.SHOP_LAT || '0');
    const shopLng = parseFloat(process.env.SHOP_LNG || '0');

    if (shopLat !== 0 && shopLng !== 0) {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return NextResponse.json({ error: 'Location permission is required to clock in.' }, { status: 400 });
      }
      const dist = distanceMeters(lat, lng, shopLat, shopLng);
      if (dist > 300) {
        return NextResponse.json(
          { error: `You must be at the shop to clock in/out. (${Math.round(dist)}m away)` },
          { status: 403 }
        );
      }
    }

    const uid = parseInt(userId);
    const openEntry = await prisma.timeEntry.findFirst({
      where: { userId: uid, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });

    if (openEntry) {
      const now = new Date();
      const diffMs = now.getTime() - openEntry.checkIn.getTime();
      const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      const entry = await prisma.timeEntry.update({
        where: { id: openEntry.id },
        data: { checkOut: now, totalHours },
      });

      return NextResponse.json({ action: 'out', entry });
    } else {
      const entry = await prisma.timeEntry.create({
        data: { userId: uid, checkIn: new Date(), breakHours: 0 },
      });

      return NextResponse.json({ action: 'in', entry });
    }
  } catch (error) {
    console.error('Clock error:', error);
    return NextResponse.json({ error: 'Failed to clock in/out' }, { status: 500 });
  }
}
