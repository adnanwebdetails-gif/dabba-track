import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncParcelTracking } from '@/lib/tracking';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const { trackingNumber } = await params;
    
    const apiKey = process.env.TRACKINGMORE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'TrackingMore API key is missing. Please add TRACKINGMORE_API_KEY to your .env file.' 
      }, { status: 500 });
    }

    // Find parcel or create placeholder
    let parcel = await prisma.parcel.findUnique({
      where: { trackingNumber },
    });

    if (!parcel) {
      parcel = await prisma.parcel.create({
        data: {
          trackingNumber,
          status: 'logged',
        },
      });
    }

    const updatedParcel = await syncParcelTracking(parcel, apiKey);
    return NextResponse.json(updatedParcel);
  } catch (error: any) {
    console.error('Error tracking parcel:', error);
    return NextResponse.json({ error: error.message || 'Failed to sync live status' }, { status: 500 });
  }
}
