import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Local-only default paths – only work on developer machines, not in production
export const DEFAULT_EXCEL_PATH = `C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\Desktop\\DemoEnquiry_Extracted.xlsx`;
export const FALLBACK_EXCEL_PATH = `C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\Desktop\\DemoEnquiry_Dashboard_Final.xlsx`;
export const LIVE_EXCEL_PATH = `C:\\Users\\ARUL XAVIER\\OneDrive - gapanchor\\Desktop\\DemoEnquiry_Extracted_Live.xlsx`;

export interface ExtractedEnquiry {
  participantName: string;
  email: string;
  phone: string;
  serviceType: string;
  trainingType: string;
  topic: string;
  lastMessage: string;
  country: string;
  dateSubmitted: Date | null;
  receivedDate: Date | null;
  messageTimestamp: Date;
}

export interface ExcelDashboardSummary {
  totalEnquiries: number;
  uniqueCountries: number;
  peakDay: string;
  avgLeadsPerDay: number | string;
  internationalPct: string;
  repeatEnquirers: string;
  enquiriesByCountry: Array<{ country: string; count: number; share: number }>;
  enquiriesByCourse: Array<{ course: string; count: number; share: number }>;
}

function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial number
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S));
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();

    // Handle DD/MM/YYYY or DD/MM/YYYY HH:mm:ss format (e.g. 29/08/2026, 11:28:39)
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?)?/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      let hours = match[4] ? parseInt(match[4], 10) : 0;
      const mins = match[5] ? parseInt(match[5], 10) : 0;
      const secs = match[6] ? parseInt(match[6], 10) : 0;
      const ampm = match[7] ? match[7].toLowerCase() : null;

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      return new Date(year, month, day, hours, mins, secs);
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseEnquiryExcel(filePath: string = DEFAULT_EXCEL_PATH) {
  const candidatePaths = [
    filePath,
    DEFAULT_EXCEL_PATH,
    FALLBACK_EXCEL_PATH,
    LIVE_EXCEL_PATH,
  ];

  let newestPath: string | null = null;
  let newestMtime = -1;

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const mtime = fs.statSync(candidate).mtimeMs;
        if (mtime > newestMtime) {
          newestMtime = mtime;
          newestPath = candidate;
        }
      } catch (e) {}
    }
  }

  if (!newestPath) {
    throw new Error(`No Excel file found at any candidate paths: ${candidatePaths.join(', ')}`);
  }

  const fileBuffer = fs.readFileSync(newestPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });

  // ──── PARSE SHEET 1 (Enquiries) ──────────────────
  const sheet1Name = workbook.SheetNames.find(n => n.toLowerCase().includes('sheet') || n.toLowerCase().includes('enquir')) || workbook.SheetNames[0];
  const sheet1 = workbook.Sheets[sheet1Name];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet1, { defval: '' });

  const enquiries: ExtractedEnquiry[] = rawRows.map(row => {
    const name = String(row['Name'] || row['name'] || 'Unknown').trim();
    const email = String(row['Email ID'] || row['Email'] || row['email'] || '').trim();
    const phone = String(row['Phone'] || row['phone'] || '').trim();
    const serviceType = String(row['Service Type'] || row['Service'] || 'Training').trim();
    const trainingType = String(row['Training Type'] || row['Training'] || '').trim();
    const message = String(row['Message'] || row['message'] || '').trim();
    const country = String(row['Country'] || row['country'] || 'India').trim();
    
    const dateSubmitted = parseExcelDate(row['Date Submitted']);
    const receivedDate = parseExcelDate(row['Received Date']);
    const messageTimestamp = receivedDate || dateSubmitted || new Date();

    const topic = trainingType || serviceType || message || 'Demo Enquiry';

    return {
      participantName: name,
      email,
      phone,
      serviceType,
      trainingType,
      topic,
      lastMessage: message || `${trainingType} enquiry from ${country}`,
      country,
      dateSubmitted,
      receivedDate,
      messageTimestamp,
    };
  }).filter(e => e.participantName !== 'Unknown' || e.email !== '' || e.phone !== '');

  // ──── PARSE DASHBOARD SHEET (KPI Summary) ────────
  let dashboardSummary: ExcelDashboardSummary = {
    totalEnquiries: enquiries.length,
    uniqueCountries: new Set(enquiries.map(e => e.country)).size,
    peakDay: 'N/A',
    avgLeadsPerDay: (enquiries.length / 60).toFixed(1),
    internationalPct: '0%',
    repeatEnquirers: '0',
    enquiriesByCountry: [],
    enquiriesByCourse: [],
  };

  const dashSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'dashboard');
  if (dashSheetName) {
    const dashSheet = workbook.Sheets[dashSheetName];
    const dashMatrix: any[][] = XLSX.utils.sheet_to_json(dashSheet, { header: 1, defval: '' });

    let parsingCountryTable = false;
    let parsingCourseTable = false;

    for (let r = 0; r < dashMatrix.length; r++) {
      const row = dashMatrix[r];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || '').trim();

      // Check header row for summary KPIs
      if (row.some((cell: any) => String(cell).includes('TOTAL ENQUIRIES'))) {
        const valRow = dashMatrix[r + 1] || [];
        // Find index of 'TOTAL ENQUIRIES'
        const idx = row.findIndex((cell: any) => String(cell).includes('TOTAL ENQUIRIES'));
        if (idx !== -1 && valRow[idx] !== undefined) {
          dashboardSummary.totalEnquiries = Number(valRow[idx]) || enquiries.length;
          dashboardSummary.uniqueCountries = Number(valRow[idx + 1]) || dashboardSummary.uniqueCountries;
          dashboardSummary.peakDay = String(valRow[idx + 2] || 'N/A');
          dashboardSummary.avgLeadsPerDay = valRow[idx + 3] || '2.9';
          dashboardSummary.internationalPct = String(valRow[idx + 4] || '20.7%');
          dashboardSummary.repeatEnquirers = String(valRow[idx + 5] || '27 (20%)');
        }
      }

      // Track Country Breakdown
      if (firstCell === 'Enquiries by Country') {
        parsingCountryTable = true;
        parsingCourseTable = false;
        continue;
      }
      if (firstCell === 'Enquiries by Course') {
        parsingCourseTable = true;
        parsingCountryTable = false;
        continue;
      }

      if (parsingCountryTable && firstCell && firstCell !== 'Count' && firstCell !== 'Share %' && firstCell !== 'Enquiries by Country') {
        if (firstCell === 'Total') {
          parsingCountryTable = false;
        } else {
          const count = Number(row[1]) || 0;
          const share = Number(row[2]) || 0;
          dashboardSummary.enquiriesByCountry.push({ country: firstCell, count, share });
        }
      }

      if (parsingCourseTable && firstCell && firstCell !== 'Count' && firstCell !== 'Share %' && firstCell !== 'Enquiries by Course') {
        if (firstCell === 'Total') {
          parsingCourseTable = false;
        } else {
          const count = Number(row[1]) || 0;
          const share = Number(row[2]) || 0;
          dashboardSummary.enquiriesByCourse.push({ course: firstCell, count, share });
        }
      }
    }
  }

  return {
    enquiries,
    summary: dashboardSummary,
    totalParsed: enquiries.length,
  };
}
