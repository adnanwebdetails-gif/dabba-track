import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search } },
        { customerName: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const parcels = await prisma.parcel.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(parcels);
  } catch (error: any) {
    console.error('Error fetching parcels:', error);
    return NextResponse.json({ error: 'Failed to fetch parcels' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Support both single parcel and array of parcels
    const parcelsData = Array.isArray(data) ? data : [data];

    if (parcelsData.length === 0) {
      return NextResponse.json({ error: 'No parcel data provided' }, { status: 400 });
    }

    // Check for duplicates in the input itself
    const trackingNumbers = parcelsData
      .map((p) => p.trackingNumber?.trim())
      .filter(Boolean);
      
    if (trackingNumbers.length !== parcelsData.length) {
      return NextResponse.json({ error: 'Tracking number is required for all parcels' }, { status: 400 });
    }

    const uniqueTrackingNumbers = new Set(trackingNumbers);
    if (uniqueTrackingNumbers.size !== trackingNumbers.length) {
      return NextResponse.json({ error: 'Duplicate tracking numbers in input data' }, { status: 400 });
    }

    // Check database for existing tracking numbers
    const existingParcels = await prisma.parcel.findMany({
      where: {
        trackingNumber: {
          in: trackingNumbers,
        },
      },
      select: {
        trackingNumber: true,
      },
    });

    if (existingParcels.length > 0) {
      const duplicates = existingParcels.map((p) => p.trackingNumber).join(', ');
      return NextResponse.json({ 
        error: `Parcel(s) with tracking number already exist in DabbaTrack: ${duplicates}` 
      }, { status: 400 });
    }

    // Insert into database
    const createdParcels = [];
    for (const item of parcelsData) {
      const initialStatus = item.status || 'logged';
      const defaultCheckpoints = [
        {
          date: new Date().toISOString(),
          location: 'Surat',
          description: `Parcel logged & booked at Surat Warehouse${item.orderNo ? ` for Order #${item.orderNo}` : ''}`,
          status: initialStatus
        }
      ];

      const created = await prisma.parcel.create({
        data: {
          trackingNumber: item.trackingNumber.trim(),
          customerName: item.customerName || null,
          address: item.address || null,
          city: item.city || null,
          codAmount: item.codAmount ? parseFloat(item.codAmount) : null,
          orderNo: item.orderNo || null,
          courierCode: item.courierCode || null,
          status: initialStatus,
          lastCheckpoint: item.lastCheckpoint || `Logged at Surat Warehouse`,
          eta: item.eta ? new Date(item.eta) : null,
          trackingmoreId: item.trackingmoreId || null,
          checkpointsJson: JSON.stringify(defaultCheckpoints),
        },
      });
      createdParcels.push(created);
    }

    return NextResponse.json({
      message: `Successfully saved ${createdParcels.length} parcel(s)`,
      parcels: createdParcels,
    });
  } catch (error: any) {
    console.error('Error creating parcels:', error);
    return NextResponse.json({ error: error.message || 'Failed to create parcels' }, { status: 500 });
  }
}
