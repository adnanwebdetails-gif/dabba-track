import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        creditsLeft: (user as any).creditsLeft,
        hasApiKey: !!user.trackingmoreApiKey,
        // Expose a masked version or placeholder of the API key if needed, or just status
        apiKeyMasked: user.trackingmoreApiKey ? `${user.trackingmoreApiKey.slice(0, 4)}...${user.trackingmoreApiKey.slice(-4)}` : null,
      },
    });
  } catch (error: any) {
    console.error('Session get error:', error);
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trackingmoreApiKey } = await req.json();

    if (trackingmoreApiKey === undefined) {
      return NextResponse.json({ error: 'trackingmoreApiKey is required' }, { status: 400 });
    }

    // Update API key in DB
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        trackingmoreApiKey: trackingmoreApiKey.trim() || null,
        creditsLeft: 50, // Reset credits to 50 whenever key is updated
      },
      select: {
        id: true,
        email: true,
        trackingmoreApiKey: true,
        creditsLeft: true,
      },
    });

    return NextResponse.json({
      message: 'API Key updated successfully',
      user: {
        id: updated.id,
        email: updated.email,
        creditsLeft: updated.creditsLeft,
        hasApiKey: !!updated.trackingmoreApiKey,
        apiKeyMasked: updated.trackingmoreApiKey ? `${updated.trackingmoreApiKey.slice(0, 4)}...${updated.trackingmoreApiKey.slice(-4)}` : null,
      },
    });
  } catch (error: any) {
    console.error('Session update error:', error);
    return NextResponse.json({ error: 'Failed to update API Key' }, { status: 500 });
  }
}
