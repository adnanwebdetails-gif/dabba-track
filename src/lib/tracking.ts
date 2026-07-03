import { prisma } from './prisma';

export async function syncParcelTracking(
  parcel: { id: string; trackingNumber: string; courierCode: string | null },
  apiKey: string
) {
  let courierCode = parcel.courierCode;
  const trackingNumber = parcel.trackingNumber;

  // 1. Auto-detect if no courier code
  if (!courierCode) {
    try {
      const detectResponse = await fetch('https://api.trackingmore.com/v4/couriers/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Tracking-Api-Key': apiKey,
        },
        body: JSON.stringify({ tracking_number: trackingNumber }),
      });

      if (detectResponse.ok) {
        const detectData = await detectResponse.json();
        if (detectData.data && detectData.data.length > 0) {
          courierCode = detectData.data[0].courier_code;
          // Update courier code in DB
          await prisma.parcel.update({
            where: { id: parcel.id },
            data: { courierCode },
          });
        }
      }
    } catch (err) {
      console.error('Error auto-detecting courier:', err);
    }
  }

  if (!courierCode) {
    throw new Error('Courier code could not be detected. Set it manually.');
  }

  // 2. Try to create tracking in TrackingMore
  let tmData: any = null;
  const createResponse = await fetch('https://api.trackingmore.com/v4/trackings/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Tracking-Api-Key': apiKey,
    },
    body: JSON.stringify({
      tracking_number: trackingNumber,
      courier_code: courierCode,
    }),
  });

  const createResult = await createResponse.json();

  if (createResponse.ok && createResult.data) {
    tmData = createResult.data;
  } else {
    const errorCode = createResult.meta?.code;
    const errorMsg = createResult.meta?.message || '';

    if (
      errorCode === 4016 ||
      errorMsg.toLowerCase().includes('already exists') ||
      errorMsg.toLowerCase().includes('exists')
    ) {
      const getResponse = await fetch(
        `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Tracking-Api-Key': apiKey,
          },
        }
      );

      if (getResponse.ok) {
        const getResult = await getResponse.json();
        if (getResult.data && getResult.data.length > 0) {
          tmData = getResult.data[0];
        }
      } else {
        const getErrorResult = await getResponse.json();
        throw new Error(getErrorResult.meta?.message || 'Failed to fetch existing tracking status.');
      }
    } else {
      throw new Error(createResult.meta?.message || 'Failed to register tracking with the Service.');
    }
  }

  if (!tmData) {
    throw new Error('No tracking details returned from the Service.');
  }

  // 3. Map statuses
  const deliveryStatus = tmData.delivery_status;
  const latestEvent = tmData.latest_event || '';
  const hasRtoText = /return|rto|returned/i.test(latestEvent);

  let status = 'logged';
  if (hasRtoText) {
    status = 'rto';
  } else {
    switch (deliveryStatus) {
      case 'pending':
      case 'inforeceived':
      case 'notfound':
        status = 'logged';
        break;
      case 'transit':
      case 'expired':
        status = 'in_transit';
        break;
      case 'pickup':
        status = 'out_for_delivery';
        break;
      case 'delivered':
        status = 'delivered';
        break;
      case 'undelivered':
      case 'exception':
        status = 'exception';
        break;
      default:
        status = 'logged';
    }
  }

  const eta = tmData.scheduled_delivery_date ? new Date(tmData.scheduled_delivery_date) : null;
  const trackingmoreId = tmData.id ? String(tmData.id) : null;
  const lastCheckpoint = latestEvent || null;

  // Extract checkpoints from origin or destination info
  const originTrackinfo = tmData.origin_info?.trackinfo || [];
  const destTrackinfo = tmData.destination_info?.trackinfo || [];
  const rawCheckpoints = originTrackinfo.length >= destTrackinfo.length ? originTrackinfo : destTrackinfo;

  const checkpoints = Array.isArray(rawCheckpoints)
    ? rawCheckpoints.map((cp: any) => ({
        date: cp.Date || cp.checkpoint_date || new Date().toISOString(),
        location: cp.Details || cp.location || 'Unknown Hub',
        description: cp.StatusDescription || cp.status_description || '',
        status: cp.checkpoint_status || cp.status || 'transit'
      }))
    : [];

  const checkpointsJson = checkpoints.length > 0 ? JSON.stringify(checkpoints) : null;

  // 4. Update local database
  return await prisma.parcel.update({
    where: { id: parcel.id },
    data: {
      status,
      lastCheckpoint,
      eta,
      trackingmoreId,
      courierCode,
      checkpointsJson,
    },
  });
}
