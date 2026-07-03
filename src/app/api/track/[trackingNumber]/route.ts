import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncParcelTracking } from '@/lib/tracking';
import { getSessionUser } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Retrieve user's personal API Key
    // Fetch full user record to get trackingmoreApiKey
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { trackingmoreApiKey: true },
    });

    const apiKey = dbUser?.trackingmoreApiKey || process.env.TRACKINGMORE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'TrackingMore API key is missing. Please add your personal API key in Settings.' 
      }, { status: 400 });
    }

    const { trackingNumber } = await params;
    const cleanTrackingNumber = trackingNumber.trim();
    
    // Find parcel or create placeholder under this user
    let parcel = await prisma.parcel.findFirst({
      where: { trackingNumber: cleanTrackingNumber, userId: user.id },
    });

    if (!parcel) {
      parcel = await prisma.parcel.create({
        data: {
          trackingNumber: cleanTrackingNumber,
          status: 'logged',
          userId: user.id,
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
