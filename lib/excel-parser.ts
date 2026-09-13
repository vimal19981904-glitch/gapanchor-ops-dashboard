import * as XLSX from 'xlsx';
import { getQuarterFromDate } from './utils';

export interface ParsedStatementTransaction {
  date: Date;
  type: 'income' | 'expense';
  sourceOrCategory: string;
  platform?: string;
  amount: number;
  paymentMethod: string;
  notes: string;
  quarter: string;
  year: number;
  origin: string;
  refNo?: string;
  balance?: number;
}

export function parseStatementDate(dateStr: any): Date {
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') {
    // Excel serial date number calculation (Excel Epoch 1899-12-30)
    return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
  }
  if (typeof dateStr === 'string') {
    const clean = dateStr.trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1];
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;

      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = monthNames.indexOf(monthStr.toLowerCase());
      if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthIdx, day);
      }
    }
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function autoCategorizeTransaction(
  type: 'income' | 'expense',
  particulars: string,
  amount: number
): { category: string; paymentMethod: string; platform?: string } {
  const pUpper = (particulars || '').toUpperCase();

  // 1. Payment Method Detection
  let paymentMethod = 'Bank Transfer';
  if (pUpper.includes('UPI')) paymentMethod = 'UPI';
  else if (pUpper.includes('CASH')) paymentMethod = 'Cash';
  else if (pUpper.includes('CARD') || pUpper.includes('POS')) paymentMethod = 'Credit Card';
  else if (pUpper.includes('IMPS') || pUpper.includes('NEFT') || pUpper.includes('RTGS')) paymentMethod = 'Bank Transfer';

  // 2. Platform Detection
  let platform: string | undefined = undefined;
  if (pUpper.includes('WMS') || pUpper.includes('MANHATTAN')) platform = 'Manhattan WMS';
  else if (pUpper.includes('BY') || pUpper.includes('BLUE YONDER') || pUpper.includes('IDA')) platform = 'Blue Yonder';
  else if (pUpper.includes('KINAXIS')) platform = 'Kinaxis';
  else if (pUpper.includes('SAP') || pUpper.includes('HANA')) platform = 'SAP S/4HANA';

  // 3. Category Detection
  let category = type === 'income' ? 'Training Fees' : 'Ops & General';

  if (type === 'income') {
    if (pUpper.includes('CONSULTING') || pUpper.includes('AUDIT') || pUpper.includes('MILESTONE')) {
      category = 'Consulting';
    } else if (pUpper.includes('BATCH') || pUpper.includes('COHORT') || pUpper.includes('FEES') || pUpper.includes('WMS') || pUpper.includes('BOOTCAMP')) {
      category = 'Training Fees';
    } else {
      category = 'Training Fees';
    }
  } else {
    // Expense
    if (pUpper.includes('SALARY') || pUpper.includes('TRAINER') || pUpper.includes('HONORARIUM') || pUpper.includes('FACULTY')) {
      category = 'Trainer Salary';
    } else if (
      pUpper.includes('AWS') || pUpper.includes('CLOUD') || pUpper.includes('INFRA') ||
      pUpper.includes('ZOOM') || pUpper.includes('MONITOR') || pUpper.includes('LAPTOP') ||
      pUpper.includes('APPAREL') || pUpper.includes('OFFICE') || pUpper.includes('SOFTWARE')
    ) {
      category = 'Office & Infrastructure';
    } else if (
      pUpper.includes('ADS') || pUpper.includes('LINKEDIN') || pUpper.includes('FACEBOOK') ||
      pUpper.includes('MARKETING') || pUpper.includes('CAMPAIGN') || pUpper.includes('INVESTMENT')
    ) {
      category = 'Marketing & Investments';
    } else {
      category = 'Ops & Venue Logistics';
    }
  }

  return { category, paymentMethod, platform };
}

// Helper to identify if a row is a summary / total row
function isSummaryOrFooterRow(particulars: string, refNo: string, rawDate: any): boolean {
  const p = (particulars || '').trim().toLowerCase();
  const ref = (refNo || '').trim().toLowerCase();
  const d = String(rawDate || '').trim().toLowerCase();

  if (p === 'total' || p.includes('total') || p.includes('effective available balance') || p.includes('computer generated')) return true;
  if (ref === 'total' || ref.includes('total')) return true;
  if (d.includes('total') || d.includes('effective available balance') || d.includes('computer generated')) return true;

  return false;
}

export function parseExcelWorkbook(fileBuffer: Buffer | ArrayBuffer): ParsedStatementTransaction[] {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames.includes('Statement')
    ? 'Statement'
    : wb.SheetNames.includes('Transactions')
    ? 'Transactions'
    : wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  // Parse as raw 2D array matrix to find dynamic header row (handles top metadata lines)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  let headerIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (
      Array.isArray(row) &&
      row.some((cell) => String(cell).toLowerCase().includes('date')) &&
      row.some((cell) => String(cell).toLowerCase().includes('particular') || String(cell).toLowerCase().includes('description'))
    ) {
      headerIndex = i;
      break;
    }
  }

  const result: ParsedStatementTransaction[] = [];

  if (headerIndex !== -1) {
    const headers = rows[headerIndex].map((h) => String(h || '').trim());
    const dateIdx = headers.findIndex((h) => h.toLowerCase().includes('date'));
    const particularsIdx = headers.findIndex((h) => h.toLowerCase().includes('particular') || h.toLowerCase().includes('description'));
    const refIdx = headers.findIndex((h) => h.toLowerCase().includes('ref') || h.toLowerCase().includes('cheque'));
    const debitIdx = headers.findIndex((h) => h.toLowerCase().includes('debit'));
    const creditIdx = headers.findIndex((h) => h.toLowerCase().includes('credit'));
    const balanceIdx = headers.findIndex((h) => h.toLowerCase().includes('balance'));

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawDate = dateIdx !== -1 ? row[dateIdx] : row[0];
      const particulars = particularsIdx !== -1 ? String(row[particularsIdx] || '') : '';
      const refNo = refIdx !== -1 ? String(row[refIdx] || '') : '';
      const debit = debitIdx !== -1 ? parseFloat(row[debitIdx] || 0) : 0;
      const credit = creditIdx !== -1 ? parseFloat(row[creditIdx] || 0) : 0;
      const balance = balanceIdx !== -1 ? parseFloat(row[balanceIdx] || 0) : undefined;

      // Skip summary / total / footer rows
      if (isSummaryOrFooterRow(particulars, refNo, rawDate)) continue;

      if (!credit && !debit) continue;
      // Skip if both credit and debit are non-zero summary values
      if (credit > 0 && debit > 0) continue;

      const isCredit = credit > 0;
      const amount = isCredit ? credit : debit;
      const type: 'income' | 'expense' = isCredit ? 'income' : 'expense';
      const parsedDate = parseStatementDate(rawDate);
      const quarter = getQuarterFromDate(parsedDate);
      const year = parsedDate.getFullYear();

      const { category, paymentMethod, platform } = autoCategorizeTransaction(type, particulars, amount);

      result.push({
        date: parsedDate,
        type,
        sourceOrCategory: category,
        platform,
        amount,
        paymentMethod,
        notes: particulars ? `${particulars}${refNo ? ` [Ref: ${refNo}]` : ''}` : `Statement Transaction ${refNo}`,
        quarter,
        year,
        origin: 'excel_statement_sync',
        refNo: refNo ? String(refNo) : undefined,
        balance,
      });
    }
  } else {
    // Fallback: standard row object parsing
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
    for (const row of rawRows) {
      const rawDate = row['Date'] || row['date'] || row['Transaction Date'];
      const particulars = row['Particulars'] || row['particulars'] || row['Description'] || row['Notes'] || '';
      const refNo = row['Ref No/Cheque No'] || row['Ref No./Cheque No'] || row['Ref No'] || row['Reference'] || '';
      const credit = parseFloat(row['Credit (Rs)'] || row['Credit'] || row['credit'] || 0);
      const debit = parseFloat(row['Debit (Rs)'] || row['Debit'] || row['debit'] || 0);
      const balance = parseFloat(row['Balance (Rs)'] || row['Balance'] || 0);

      if (isSummaryOrFooterRow(particulars, refNo, rawDate)) continue;
      if (!credit && !debit) continue;
      if (credit > 0 && debit > 0) continue;

      const isCredit = credit > 0;
      const amount = isCredit ? credit : debit;
      const type: 'income' | 'expense' = isCredit ? 'income' : 'expense';
      const parsedDate = parseStatementDate(rawDate);
      const quarter = getQuarterFromDate(parsedDate);
      const year = parsedDate.getFullYear();

      const { category, paymentMethod, platform } = autoCategorizeTransaction(type, particulars, amount);

      result.push({
        date: parsedDate,
        type,
        sourceOrCategory: category,
        platform,
        amount,
        paymentMethod,
        notes: particulars ? `${particulars}${refNo ? ` [Ref: ${refNo}]` : ''}` : `Statement Transaction ${refNo}`,
        quarter,
        year,
        origin: 'excel_statement_sync',
        refNo: refNo ? String(refNo) : undefined,
        balance,
      });
    }
  }

  return result;
}
