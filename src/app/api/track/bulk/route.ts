import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncParcelTracking } from '@/lib/tracking';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.TRACKINGMORE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'TrackingMore API key is missing. Please add TRACKINGMORE_API_KEY to your .env file.' 
      }, { status: 500 });
    }

    const body = await req.json().catch(() => ({ ids: null }));
    const ids = body?.ids;

    let parcels;
    if (ids && Array.isArray(ids)) {
      parcels = await prisma.parcel.findMany({
        where: { id: { in: ids } }
      });
    } else {
      parcels = await prisma.parcel.findMany({
        where: {
          NOT: {
            status: { in: ['delivered', 'rto'] }
          }
        }
      });
    }

    if (parcels.length === 0) {
      return NextResponse.json({
        message: 'No parcels found requiring updates.',
        results: [],
        succeeded: 0,
        failed: 0,
      });
    }

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < parcels.length; i++) {
      const parcel = parcels[i];
      
      // Delay to respect the TrackingMore API rate limit (~3 requests per second)
      // Skip delay for the first item
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      try {
        const updated = await syncParcelTracking(parcel, apiKey);
        results.push({
          id: parcel.id,
          trackingNumber: parcel.trackingNumber,
          success: true,
          status: updated.status,
        });
        succeeded++;
      } catch (err: any) {
        console.error(`Error bulk tracking parcel ${parcel.trackingNumber}:`, err);
        results.push({
          id: parcel.id,
          trackingNumber: parcel.trackingNumber,
          success: false,
          error: err.message || 'Unknown error',
        });
        failed++;
      }
    }

    return NextResponse.json({
      message: `Bulk update completed: ${succeeded} succeeded, ${failed} failed.`,
      results,
      succeeded,
      failed,
    });
  } catch (error: any) {
    console.error('Error in bulk tracking route:', error);
    return NextResponse.json({ error: 'Internal server error during bulk track' }, { status: 500 });
  }
}
