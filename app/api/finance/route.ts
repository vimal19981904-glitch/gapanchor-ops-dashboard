import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuarterFromDate } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter');
    const year = searchParams.get('year');

    const where: any = {};
    if (quarter) where.quarter = quarter;
    if (year) where.year = parseInt(year);

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const netProfit = totalIncome - totalExpense;

    // Income by source
    const incomeBySource: Record<string, number> = {};
    income.forEach(t => {
      incomeBySource[t.sourceOrCategory] = (incomeBySource[t.sourceOrCategory] || 0) + t.amount;
    });

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    expenses.forEach(t => {
      expenseByCategory[t.sourceOrCategory] = (expenseByCategory[t.sourceOrCategory] || 0) + t.amount;
    });

    // Quarterly trends
    const allTx = await prisma.transaction.findMany({ orderBy: { date: 'desc' } });
    const quarterlyTrends = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
      const qIncome = allTx.filter(t => t.quarter === q && t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const qExpense = allTx.filter(t => t.quarter === q && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { quarter: q, income: qIncome, expense: qExpense, net: qIncome - qExpense };
    });

    // Graph API connection status
    const graphConfig = await prisma.integrationConfig.findUnique({ where: { service: 'microsoft_graph' } });

    return NextResponse.json({
      success: true,
      summary: { totalIncome, totalExpense, netProfit, incomeBySource, expenseByCategory, quarterlyTrends },
      transactions,
      graphApiStatus: graphConfig ? {
        connected: graphConfig.connected,
        lastSynced: graphConfig.lastSynced,
        ...(graphConfig.metadata ? JSON.parse(graphConfig.metadata) : {}),
      } : { connected: false },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, sourceOrCategory, platform, amount, paymentMethod, notes, date } = body;

    if (!type || !amount || !sourceOrCategory) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const txDate = date ? new Date(date) : new Date();
    const entry = await prisma.transaction.create({
      data: {
        date: txDate,
        type,
        sourceOrCategory,
        platform: platform || null,
        amount: parseFloat(amount),
        paymentMethod: paymentMethod || 'Manual',
        notes: notes || '',
        quarter: getQuarterFromDate(txDate),
        year: txDate.getFullYear(),
        origin: 'manual',
      },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id || body.transactionId;
      } catch (e) {
        // ignore JSON parse error if no body
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Transaction ID is required for deletion.' }, { status: 400 });
    }

    // 1. Fetch existing transaction for purge log archive
    const existing = await prisma.transaction.findUnique({
      where: { id },
    });

    if (existing) {
      try {
        const auditLog = await prisma.integrationConfig.findUnique({
          where: { service: 'finance_purge_log' },
        });
        const currentLogs = auditLog?.metadata ? JSON.parse(auditLog.metadata) : [];
        currentLogs.unshift({
          id: existing.id,
          date: existing.date,
          type: existing.type,
          sourceOrCategory: existing.sourceOrCategory,
          platform: existing.platform,
          amount: existing.amount,
          paymentMethod: existing.paymentMethod,
          notes: existing.notes,
          origin: existing.origin,
          deletedAt: new Date().toISOString(),
        });

        await prisma.integrationConfig.upsert({
          where: { service: 'finance_purge_log' },
          update: {
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
          create: {
            service: 'finance_purge_log',
            connected: true,
            metadata: JSON.stringify(currentLogs.slice(0, 500)),
            lastSynced: new Date(),
          },
        });
      } catch (logErr) {
        console.error('Finance purge audit log error:', logErr);
      }

      // 2. Perform actual deletion from Transaction table
      await prisma.transaction.delete({
        where: { id },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Transaction record has been permanently deleted and archived to purge logs.`,
      transactionId: id,
    });
  } catch (error: any) {
    console.error('Error deleting transaction record:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

