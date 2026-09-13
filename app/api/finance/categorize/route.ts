import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sourceOrCategory, paymentMethod, platform, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required.' }, { status: 400 });
    }

    const updateData: any = {};
    if (sourceOrCategory !== undefined) updateData.sourceOrCategory = sourceOrCategory;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (platform !== undefined) updateData.platform = platform || null;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Transaction categorized successfully.`,
      transaction: updated,
    });
  } catch (error: any) {
    console.error('Error categorizing transaction:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to categorize transaction' },
      { status: 500 }
    );
  }
}
