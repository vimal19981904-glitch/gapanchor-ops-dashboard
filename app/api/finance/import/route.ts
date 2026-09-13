import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseExcelWorkbook, ParsedStatementTransaction } from '@/lib/excel-parser';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    let fileBuffer: Buffer | null = null;
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (file) {
        const bytes = await file.arrayBuffer();
        fileBuffer = Buffer.from(bytes);
      }
    } else {
      let body: any = {};
      try {
        body = await request.json();
      } catch (e) {
        // ignore
      }

      const defaultPaths = [
        'C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\dashboard\\Account_Statement.xlsx',
        'C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\dashboard\\Account_Statement_Converted.xlsx',
      ];

      const targetPath = body.filePath || defaultPaths.find(p => fs.existsSync(p)) || defaultPaths[0];

      if (fs.existsSync(targetPath)) {
        fileBuffer = fs.readFileSync(targetPath);
      } else {
        return NextResponse.json(
          { success: false, error: `Excel file not found at path: ${targetPath}` },
          { status: 404 }
        );
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { success: false, error: 'No valid Excel file provided for sync.' },
        { status: 400 }
      );
    }

    const parsedTx = parseExcelWorkbook(fileBuffer);

    if (!parsedTx || parsedTx.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid transaction rows found in the Excel statement.' },
        { status: 400 }
      );
    }

    // Cleanly replace existing excel_statement_sync records to prevent duplicate accumulation across re-syncs
    await prisma.transaction.deleteMany({
      where: { origin: 'excel_statement_sync' },
    });

    let importedCount = 0;
    const skippedCount = 0;
    let totalIncomeImported = 0;
    let totalExpenseImported = 0;

    for (const tx of parsedTx) {
      await prisma.transaction.create({
        data: {
          date: tx.date,
          type: tx.type,
          sourceOrCategory: tx.sourceOrCategory,
          platform: tx.platform || null,
          amount: tx.amount,
          paymentMethod: tx.paymentMethod,
          notes: tx.notes,
          quarter: tx.quarter,
          year: tx.year,
          origin: tx.origin,
        },
      });

      importedCount++;
      if (tx.type === 'income') totalIncomeImported += tx.amount;
      else totalExpenseImported += tx.amount;
    }

    // Save import audit in IntegrationConfig
    try {
      await prisma.integrationConfig.upsert({
        where: { service: 'excel_statement_last_sync' },
        update: {
          connected: true,
          metadata: JSON.stringify({
            importedCount,
            skippedCount,
            totalRows: parsedTx.length,
            totalIncomeImported,
            totalExpenseImported,
            lastSyncedAt: new Date().toISOString(),
          }),
          lastSynced: new Date(),
        },
        create: {
          service: 'excel_statement_last_sync',
          connected: true,
          metadata: JSON.stringify({
            importedCount,
            skippedCount,
            totalRows: parsedTx.length,
            totalIncomeImported,
            totalExpenseImported,
            lastSyncedAt: new Date().toISOString(),
          }),
          lastSynced: new Date(),
        },
      });
    } catch (auditErr) {
      console.error('Error saving excel sync config:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${parsedTx.length} transactions (${importedCount} new imported, ${skippedCount} skipped/duplicates).`,
      summary: {
        totalRows: parsedTx.length,
        importedCount,
        skippedCount,
        totalIncomeImported,
        totalExpenseImported,
        netMarginImported: totalIncomeImported - totalExpenseImported,
      },
    });
  } catch (error: any) {
    console.error('Error importing Excel statement:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to import Excel statement.' },
      { status: 500 }
    );
  }
}
