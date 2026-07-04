import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: any = {
      userId: user.id,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
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
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Check database for existing tracking numbers globally (since trackingNumber is @unique)
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
        error: `Parcel(s) with tracking number already exist in the system: ${duplicates}` 
      }, { status: 400 });
    }

    // Check credits
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (dbUser.creditsLeft < parcelsData.length) {
      return NextResponse.json({ 
        error: `Insufficient credits. You are trying to add ${parcelsData.length} parcel(s) but only have ${dbUser.creditsLeft} credit(s) left. Please add a new Activation Key in Settings.` 
      }, { status: 400 });
    }

    // Prepare data for bulk insert
    const parcelsDataToInsert = parcelsData.map(item => {
      const initialStatus = item.status || 'logged';
      const defaultCheckpoints = [
        {
          date: new Date().toISOString(),
          location: 'Surat',
          description: `Parcel logged & booked at Surat Warehouse${item.orderNo ? ` for Order #${item.orderNo}` : ''}`,
          status: initialStatus
        }
      ];

      return {
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
        userId: user.id,
      };
    });

    // Insert into database using createMany (transactional, skips duplicates gracefully)
    const result = await prisma.parcel.createMany({
      data: parcelsDataToInsert,
      skipDuplicates: true,
    });

    const createdCount = result.count;

    // Deduct credits based on actual inserted count
    if (createdCount > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { creditsLeft: { decrement: createdCount } }
      });
    }

    return NextResponse.json({
      message: `Successfully saved ${createdCount} parcel(s)`,
      count: createdCount,
    });
  } catch (error: any) {
    console.error('Error creating parcels:', error);
    return NextResponse.json({ error: error.message || 'Failed to create parcels' }, { status: 500 });
  }
}
