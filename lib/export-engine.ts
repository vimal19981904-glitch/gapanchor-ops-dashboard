import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ExportFieldDefinition {
  key: string;
  defaultLabel: string;
  category: 'Identity' | 'Contact' | 'Course' | 'Status' | 'Ownership' | 'Ingestion' | 'Dates' | 'Intelligence' | 'Content' | 'System';
  dataType: 'string' | 'number' | 'boolean' | 'date';
  formatter?: (val: any) => string;
}

export const EXPORTABLE_FIELDS: ExportFieldDefinition[] = [
  // Identity
  { key: 'leadCode', defaultLabel: 'Lead ID / Code', category: 'Identity', dataType: 'string' },
  
  // Contact
  { key: 'participantName', defaultLabel: 'Customer Name', category: 'Contact', dataType: 'string' },
  { key: 'email', defaultLabel: 'Email Address', category: 'Contact', dataType: 'string' },
  { key: 'phone', defaultLabel: 'Phone Number', category: 'Contact', dataType: 'string' },
  { key: 'country', defaultLabel: 'Country', category: 'Contact', dataType: 'string' },
  
  // Course
  { key: 'serviceType', defaultLabel: 'Service Type', category: 'Course', dataType: 'string' },
  { key: 'trainingType', defaultLabel: 'Course / Platform', category: 'Course', dataType: 'string' },
  { key: 'topic', defaultLabel: 'Specific Topic', category: 'Course', dataType: 'string' },
  
  // Status
  { key: 'contactStatus', defaultLabel: 'Contact Status', category: 'Status', dataType: 'string' },
  { key: 'leadQuality', defaultLabel: 'Lead Quality', category: 'Status', dataType: 'string' },
  { key: 'status', defaultLabel: 'Operational Status', category: 'Status', dataType: 'string' },
  
  // Ownership
  { key: 'assignedToName', defaultLabel: 'Assigned Counselor', category: 'Ownership', dataType: 'string' },
  
  // Ingestion
  { key: 'source', defaultLabel: 'Lead Source', category: 'Ingestion', dataType: 'string' },
  
  // Dates
  {
    key: 'messageTimestamp',
    defaultLabel: 'Enquiry Date',
    category: 'Dates',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : '',
  },
  {
    key: 'dateSubmitted',
    defaultLabel: 'Date Submitted',
    category: 'Dates',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().slice(0, 10) : '',
  },
  {
    key: 'receivedDate',
    defaultLabel: 'Received Date',
    category: 'Dates',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().slice(0, 10) : '',
  },
  
  // Intelligence
  { key: 'callScore', defaultLabel: 'Call Score', category: 'Intelligence', dataType: 'number' },
  {
    key: 'callFollowUpDate',
    defaultLabel: 'Scheduled Follow-Up',
    category: 'Intelligence',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().slice(0, 10) : '',
  },
  {
    key: 'hasRedFlag',
    defaultLabel: 'Red Flag Alert',
    category: 'Intelligence',
    dataType: 'boolean',
    formatter: (v) => (v ? 'Yes' : 'No'),
  },
  { key: 'redFlagReason', defaultLabel: 'Red Flag Reason', category: 'Intelligence', dataType: 'string' },
  
  // Content
  { key: 'processedNotes', defaultLabel: 'Operations Notes', category: 'Content', dataType: 'string' },
  { key: 'lastMessage', defaultLabel: 'Last Message', category: 'Content', dataType: 'string' },
  
  // System
  {
    key: 'isStale',
    defaultLabel: 'Is Stale',
    category: 'System',
    dataType: 'boolean',
    formatter: (v) => (v ? 'Yes' : 'No'),
  },
  { key: 'staleReason', defaultLabel: 'Stale Reason', category: 'System', dataType: 'string' },
  {
    key: 'processedAt',
    defaultLabel: 'Processed At',
    category: 'System',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : '',
  },
  {
    key: 'createdAt',
    defaultLabel: 'Record Created',
    category: 'System',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : '',
  },
  {
    key: 'updatedAt',
    defaultLabel: 'Last Updated',
    category: 'System',
    dataType: 'date',
    formatter: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : '',
  },
];

export interface SelectedFieldItem {
  key: string;
  label: string;
}

export const EXPORT_PRESETS: Record<string, { name: string; keys: string[] }> = {
  default: {
    name: 'Default Summary',
    keys: ['leadCode', 'participantName', 'phone', 'email', 'trainingType', 'contactStatus', 'messageTimestamp'],
  },
  followup: {
    name: 'Counselor & Follow-Up',
    keys: ['leadCode', 'participantName', 'phone', 'contactStatus', 'leadQuality', 'callScore', 'callFollowUpDate', 'processedNotes'],
  },
  ops: {
    name: 'Operations & Auditing',
    keys: ['leadCode', 'participantName', 'assignedToName', 'source', 'status', 'hasRedFlag', 'redFlagReason', 'updatedAt'],
  },
  master: {
    name: 'Complete Master Export',
    keys: EXPORTABLE_FIELDS.map((f) => f.key),
  },
};

/**
 * CSV formula injection defense.
 * Neutralizes formulas starting with '=', '+', '-', or '@' in spreadsheet viewers.
 */
export function sanitizeCell(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[=+\-@]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return val;
  }
  return val;
}

/**
 * Format a lead object attribute according to its field definition
 */
export function formatCellValue(lead: any, fieldDef: ExportFieldDefinition): any {
  const raw = lead[fieldDef.key];
  if (raw === null || raw === undefined) return '';
  if (fieldDef.formatter) {
    return fieldDef.formatter(raw);
  }
  return sanitizeCell(raw);
}

/**
 * Triggers browser download for a Blob
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate formatted Excel (.xlsx) file and trigger download
 */
export function generateExcelExport(
  leads: any[],
  selectedFields: SelectedFieldItem[],
  filenamePrefix: string = 'GapAnchor_Enquiries'
) {
  const fieldDefMap = new Map(EXPORTABLE_FIELDS.map((f) => [f.key, f]));

  // Build Headers row
  const headers = selectedFields.map((f) => f.label);

  // Build Data rows
  const rows = leads.map((lead) => {
    return selectedFields.map((field) => {
      const def = fieldDefMap.get(field.key);
      if (!def) return sanitizeCell(lead[field.key] ?? '');
      return formatCellValue(lead, def);
    });
  });

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-fit column widths
  const colWidths = headers.map((header, colIndex) => {
    let maxLength = header.length;
    for (let r = 0; r < Math.min(rows.length, 50); r++) {
      const val = rows[r][colIndex];
      const strLen = val ? String(val).length : 0;
      if (strLen > maxLength) maxLength = strLen;
    }
    return { wch: Math.min(Math.max(maxLength + 3, 12), 45) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Enquiries');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${dateStr}.xlsx`;
  triggerBrowserDownload(blob, filename);
  return filename;
}

/**
 * Generate formatted CSV (.csv) file and trigger download
 */
export function generateCsvExport(
  leads: any[],
  selectedFields: SelectedFieldItem[],
  filenamePrefix: string = 'GapAnchor_Enquiries'
) {
  const fieldDefMap = new Map(EXPORTABLE_FIELDS.map((f) => [f.key, f]));

  // Build Objects mapped to custom header labels
  const dataForCsv = leads.map((lead) => {
    const row: Record<string, any> = {};
    selectedFields.forEach((field) => {
      const def = fieldDefMap.get(field.key);
      row[field.label] = def ? formatCellValue(lead, def) : sanitizeCell(lead[field.key] ?? '');
    });
    return row;
  });

  // Generate CSV with PapaParse
  const csvString = Papa.unparse(dataForCsv);

  // Include UTF-8 BOM so Excel opens special characters seamlessly
  const blob = new Blob(['\uFEFF' + csvString], {
    type: 'text/csv;charset=utf-8;',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${dateStr}.csv`;
  triggerBrowserDownload(blob, filename);
  return filename;
}
