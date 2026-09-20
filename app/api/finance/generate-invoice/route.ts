import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      participantName = 'Valued Client',
      topic = 'Manhattan Active WMS Training Course',
      amountDue = 44630,
      amountPaid = 0,
      invoiceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      invoiceNo = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`,
    } = body;

    const due = typeof amountDue === 'number' ? amountDue : parseFloat(amountDue) || 0;
    const paid = typeof amountPaid === 'number' ? amountPaid : parseFloat(amountPaid) || 0;
    const balance = Math.max(0, due - paid);
    const statusText = balance === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending');

    // Create a new PDF Document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard US Letter size
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Color definitions
    const colorHeaderBg = rgb(0.05, 0.08, 0.15); // Dark blue-navy header box
    const colorCyan = rgb(0.0, 0.72, 0.83);       // #00b8d9 cyan accent
    const colorTextDark = rgb(0.12, 0.16, 0.22);  // Dark slate body text
    const colorTextMuted = rgb(0.42, 0.46, 0.54); // Gray text
    const colorGreen = rgb(0.06, 0.65, 0.42);     // Emerald green
    const colorRose = rgb(0.88, 0.22, 0.33);      // Rose red

    // Top Header Banner
    page.drawRectangle({
      x: 0,
      y: height - 120,
      width: width,
      height: 120,
      color: colorHeaderBg,
    });

    // Company Name & Text
    page.drawText('GapAnchor Consulting', {
      x: 40,
      y: height - 52,
      size: 22,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Subtitle & Contact Info
    page.drawText('Supply Chain & Enterprise Solutions Intelligence', {
      x: 40,
      y: height - 76,
      size: 10,
      font: fontRegular,
      color: colorCyan,
    });

    page.drawText('Email: contact@gapanchor.com  |  Web: www.gapanchor.com', {
      x: 40,
      y: height - 94,
      size: 9,
      font: fontRegular,
      color: rgb(0.7, 0.75, 0.85),
    });

    // Invoice Title on Top Right
    page.drawText('INVOICE', {
      x: width - 170,
      y: height - 65,
      size: 24,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Horizontal Divider Line
    page.drawLine({
      start: { x: 40, y: height - 135 },
      end: { x: width - 40, y: height - 135 },
      thickness: 2,
      color: colorCyan,
    });

    // Billing Details & Meta Table (Grid Layout)
    let yPos = height - 170;

    // Left Column: Bill To
    page.drawText('CLIENT & BILLING DETAILS', {
      x: 40,
      y: yPos,
      size: 11,
      font: fontBold,
      color: colorCyan,
    });
    yPos -= 18;

    page.drawText(`Client Name: ${participantName}`, {
      x: 40,
      y: yPos,
      size: 12,
      font: fontBold,
      color: colorTextDark,
    });
    yPos -= 16;

    page.drawText(`Training Topic: ${topic}`, {
      x: 40,
      y: yPos,
      size: 10,
      font: fontRegular,
      color: colorTextMuted,
    });
    yPos -= 16;

    page.drawText(`Service ID: GA-SVC-${Math.floor(100 + Math.random() * 900)}`, {
      x: 40,
      y: yPos,
      size: 10,
      font: fontRegular,
      color: colorTextMuted,
    });

    // Right Column: Invoice Meta
    let yMeta = height - 170;
    page.drawText('INVOICE INFORMATION', {
      x: width - 240,
      y: yMeta,
      size: 11,
      font: fontBold,
      color: colorCyan,
    });
    yMeta -= 18;

    page.drawText(`Invoice No: ${invoiceNo}`, {
      x: width - 240,
      y: yMeta,
      size: 10,
      font: fontBold,
      color: colorTextDark,
    });
    yMeta -= 16;

    page.drawText(`Invoice Date: ${invoiceDate}`, {
      x: width - 240,
      y: yMeta,
      size: 10,
      font: fontRegular,
      color: colorTextMuted,
    });
    yMeta -= 16;

    page.drawText(`Payment Method: Bank Transfer / Online`, {
      x: width - 240,
      y: yMeta,
      size: 10,
      font: fontRegular,
      color: colorTextMuted,
    });

    // Line items section box
    yPos = height - 260;
    page.drawText('INVESTMENT & FINANCIAL SUMMARY', {
      x: 40,
      y: yPos,
      size: 12,
      font: fontBold,
      color: colorHeaderBg,
    });

    yPos -= 15;

    // Table Header Bar
    page.drawRectangle({
      x: 40,
      y: yPos - 20,
      width: width - 80,
      height: 25,
      color: rgb(0.92, 0.94, 0.97),
    });

    page.drawText('DESCRIPTION / PARTICIPANT COURSE', {
      x: 50,
      y: yPos - 12,
      size: 10,
      font: fontBold,
      color: colorTextDark,
    });

    page.drawText('TOTAL DUE', {
      x: width - 260,
      y: yPos - 12,
      size: 10,
      font: fontBold,
      color: colorTextDark,
    });

    page.drawText('PAID AMOUNT', {
      x: width - 150,
      y: yPos - 12,
      size: 10,
      font: fontBold,
      color: colorTextDark,
    });

    yPos -= 45;

    // Table Row Item
    page.drawText(`${topic}`, {
      x: 50,
      y: yPos,
      size: 11,
      font: fontBold,
      color: colorTextDark,
    });

    page.drawText(`Rs. ${due.toLocaleString()}`, {
      x: width - 260,
      y: yPos,
      size: 11,
      font: fontBold,
      color: colorTextDark,
    });

    page.drawText(`Rs. ${paid.toLocaleString()}`, {
      x: width - 150,
      y: yPos,
      size: 11,
      font: fontBold,
      color: colorGreen,
    });

    yPos -= 30;
    page.drawLine({
      start: { x: 40, y: yPos },
      end: { x: width - 40, y: yPos },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    });

    // Summary Box Bottom Right
    yPos -= 25;
    const summaryBoxX = width - 280;
    
    page.drawRectangle({
      x: summaryBoxX,
      y: yPos - 90,
      width: 240,
      height: 100,
      color: rgb(0.96, 0.98, 1.0),
      borderColor: colorCyan,
      borderWidth: 1,
    });

    page.drawText(`Total Payment Amount:`, {
      x: summaryBoxX + 15,
      y: yPos - 15,
      size: 10,
      font: fontRegular,
      color: colorTextDark,
    });
    page.drawText(`Rs. ${due.toLocaleString()}`, {
      x: summaryBoxX + 160,
      y: yPos - 15,
      size: 10,
      font: fontBold,
      color: colorTextDark,
    });

    page.drawText(`Amount Paid:`, {
      x: summaryBoxX + 15,
      y: yPos - 35,
      size: 10,
      font: fontRegular,
      color: colorTextDark,
    });
    page.drawText(`Rs. ${paid.toLocaleString()}`, {
      x: summaryBoxX + 160,
      y: yPos - 35,
      size: 10,
      font: fontBold,
      color: colorGreen,
    });

    page.drawLine({
      start: { x: summaryBoxX + 15, y: yPos - 50 },
      end: { x: summaryBoxX + 225, y: yPos - 50 },
      thickness: 1,
      color: colorCyan,
    });

    page.drawText(`OUTSTANDING BALANCE:`, {
      x: summaryBoxX + 15,
      y: yPos - 75,
      size: 10,
      font: fontBold,
      color: balance > 0 ? colorRose : colorGreen,
    });
    page.drawText(`Rs. ${balance.toLocaleString()}`, {
      x: summaryBoxX + 160,
      y: yPos - 75,
      size: 12,
      font: fontBold,
      color: balance > 0 ? colorRose : colorGreen,
    });

    // Footer Terms & Signature
    const footerY = 80;
    page.drawLine({
      start: { x: 40, y: footerY + 30 },
      end: { x: width - 40, y: footerY + 30 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.92),
    });

    page.drawText('Terms & Conditions:', {
      x: 40,
      y: footerY + 15,
      size: 9,
      font: fontBold,
      color: colorTextDark,
    });
    page.drawText('Thank you for choosing GapAnchor Consulting. This invoice serves as official confirmation of training session enrollment.', {
      x: 40,
      y: footerY,
      size: 8,
      font: fontOblique,
      color: colorTextMuted,
    });

    page.drawText('Authorized Signature: GapAnchor Accounts Team', {
      x: width - 260,
      y: footerY + 15,
      size: 9,
      font: fontBold,
      color: colorTextDark,
    });

    // Save PDF Bytes
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Attempt to persist local copy if filesystem is writable; catch gracefully on read-only serverless platforms (Vercel)
    try {
      const targetDir = path.join(process.cwd(), 'Invoice');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const targetFilePath = path.join(targetDir, 'GapAnchor_Invoice.pdf');
      fs.writeFileSync(targetFilePath, pdfBuffer);
    } catch (fsErr) {
      console.warn('Skipped writing invoice file to disk (read-only filesystem):', fsErr);
    }

    // Return response with PDF binary stream
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="GapAnchor_Invoice_${participantName.replace(/\s+/g, '_')}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
