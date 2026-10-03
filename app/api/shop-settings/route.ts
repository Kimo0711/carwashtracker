import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { clientIp, networkKey, shopLocation } from '../../../lib/checkin';

export const dynamic = 'force-dynamic';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// The network the dashboard is being viewed from, so the owner can save it as the shop Wi-Fi
function currentNetwork(request: Request) {
    const ip = clientIp(request);
    return ip ? networkKey(ip) : null;
}

// GET /api/shop-settings — where employees must be to clock in/out
export async function GET(request: Request) {
    try {
        const shop = shopLocation(await prisma.shopSettings.findUnique({ where: { id: 1 } }));
        return NextResponse.json({ ...shop, currentNetwork: currentNetwork(request) });
    } catch (error) {
        console.error('Failed to fetch shop settings:', error);
        return NextResponse.json({ error: 'Failed to fetch shop settings' }, { status: 500 });
    }
}

// PUT /api/shop-settings — { lat, lng } | { addCurrentNetwork: true } | { removeNetwork: "..." }
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const existing = await prisma.shopSettings.findUnique({ where: { id: 1 } });
        const wifiNetworks = new Set(existing?.wifiNetworks ?? []);
        const data: { lat?: number; lng?: number; wifiNetworks?: string[] } = {};

        if (typeof body.lat === 'number' && typeof body.lng === 'number') {
            data.lat = body.lat;
            data.lng = body.lng;
        }

        if (body.addCurrentNetwork) {
            const network = currentNetwork(request);
            if (!network) {
                return NextResponse.json({ error: 'Could not detect your network.' }, { status: 400 });
            }
            wifiNetworks.add(network);
            data.wifiNetworks = Array.from(wifiNetworks);
        }

        if (typeof body.removeNetwork === 'string') {
            wifiNetworks.delete(body.removeNetwork);
            data.wifiNetworks = Array.from(wifiNetworks);
        }

        const saved = await prisma.shopSettings.upsert({
            where: { id: 1 },
            update: data,
            create: { id: 1, ...data },
        });

        return NextResponse.json({ ...shopLocation(saved), currentNetwork: currentNetwork(request) });
    } catch (error) {
        console.error('Failed to update shop settings:', error);
        return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
    }
}
