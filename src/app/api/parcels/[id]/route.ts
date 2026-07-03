import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { status, customerName, address, city, codAmount, orderNo, courierCode, checkpointsJson } = body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (customerName !== undefined) data.customerName = customerName;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (codAmount !== undefined) data.codAmount = codAmount !== null ? parseFloat(codAmount) : null;
    if (orderNo !== undefined) data.orderNo = orderNo;
    if (courierCode !== undefined) data.courierCode = courierCode;
    if (checkpointsJson !== undefined) data.checkpointsJson = checkpointsJson;

    const updated = await prisma.parcel.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating parcel:', error);
    return NextResponse.json({ error: 'Failed to update parcel' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.parcel.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Parcel deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting parcel:', error);
    return NextResponse.json({ error: 'Failed to delete parcel' }, { status: 500 });
  }
}
