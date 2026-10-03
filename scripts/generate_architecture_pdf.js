const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function generatePDF() {
  const mdPath = path.join(__dirname, '../docs/AZURE_GRAPH_CLOUD_ARCHITECTURE.md');
  const pdfPath = path.join(__dirname, '../docs/AZURE_GRAPH_CLOUD_ARCHITECTURE.pdf');

  if (!fs.existsSync(mdPath)) {
    console.error('Markdown doc not found at:', mdPath);
    return;
  }

  const content = fs.readFileSync(mdPath, 'utf8');
  const lines = content.split('\n');

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = 800;
  const margin = 50;
  const width = 595.28 - margin * 2;

  function checkNewPage(neededHeight = 20) {
    if (y - neededHeight < 50) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }
  }

  // Draw header banner
  page.drawRectangle({
    x: 0,
    y: 790,
    width: 595.28,
    height: 51.89,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText('GapAnchor Ops Dashboard — Cloud Azure Architecture', {
    x: margin,
    y: 810,
    size: 14,
    font: fontBold,
    color: rgb(0.22, 0.74, 0.96),
  });

  y = 760;

  for (let line of lines) {
    line = line.replace(/[^\x00-\x7F]/g, '').trimEnd();

    if (!line) {
      y -= 8;
      checkNewPage();
      continue;
    }

    if (line.startsWith('# ')) {
      y -= 15;
      checkNewPage(30);
      page.drawText(line.replace('# ', ''), {
        x: margin,
        y,
        size: 16,
        font: fontBold,
        color: rgb(0.06, 0.71, 0.83),
      });
      y -= 20;
    } else if (line.startsWith('## ')) {
      y -= 12;
      checkNewPage(25);
      page.drawText(line.replace('## ', ''), {
        x: margin,
        y,
        size: 13,
        font: fontBold,
        color: rgb(0.38, 0.40, 0.94),
      });
      y -= 18;
    } else if (line.startsWith('### ')) {
      y -= 10;
      checkNewPage(20);
      page.drawText(line.replace('### ', ''), {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      y -= 15;
    } else if (line.startsWith('> ')) {
      checkNewPage(16);
      page.drawText(line.replace('> ', ''), {
        x: margin + 10,
        y,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.45),
      });
      y -= 14;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      checkNewPage(14);
      const clean = line.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
      page.drawText(`• ${clean.slice(0, 85)}`, {
        x: margin + 10,
        y,
        size: 9,
        font: fontRegular,
        color: rgb(0.2, 0.25, 0.3),
      });
      y -= 13;
    } else if (line.startsWith('```')) {
      y -= 6;
      checkNewPage(12);
    } else {
      checkNewPage(14);
      const cleanLine = line.replace(/[`*#]/g, '').slice(0, 95);
      page.drawText(cleanLine, {
        x: margin,
        y,
        size: 9,
        font: fontRegular,
        color: rgb(0.15, 0.2, 0.25),
      });
      y -= 13;
    }
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(pdfPath, pdfBytes);
  console.log('Successfully generated PDF at:', pdfPath);
}

generatePDF().catch(console.error);
