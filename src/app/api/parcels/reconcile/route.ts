import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const updates = await req.json(); // Array of { id: string, status: string }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Invalid updates payload' }, { status: 400 });
    }

    // Run updates inside a Prisma transaction
    const tx = updates.map((update) => 
      prisma.parcel.update({
        where: { id: update.id },
        data: { status: update.status },
      })
    );

    await prisma.$transaction(tx);

    return NextResponse.json({ 
      message: `Successfully reconciled and updated ${updates.length} parcel(s)` 
    });
  } catch (error: any) {
    console.error('Error reconciling parcels:', error);
    return NextResponse.json({ error: 'Failed to apply reconciliation updates' }, { status: 500 });
  }
}
