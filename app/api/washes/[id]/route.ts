import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = parseInt((await params).id);
        await prisma.wash.delete({
            where: { id },
        });
        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting wash:', error);
        return NextResponse.json({ error: 'Error deleting wash' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = parseInt((await params).id);
        const body = await request.json();

        const updatedWash = await prisma.wash.update({
            where: { id },
            data: {
                parsedCar: body.carType,
                parsedService: body.service,
                parsedPrice: parseFloat(body.price),
                carType: body.carType, // Keep consistent
            },
        });

        return NextResponse.json(updatedWash);
    } catch (error) {
        console.error('Error updating wash:', error);
        return NextResponse.json({ error: 'Error updating wash' }, { status: 500 });
    }
}
