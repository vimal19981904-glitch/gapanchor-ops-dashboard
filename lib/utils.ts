export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function getQuarterFromDate(date: Date): string {
  const month = date.getMonth();
  if (month >= 3 && month <= 5) return 'Q1'; // 1 Apr – 30 Jun (Q1 FY)
  if (month >= 6 && month <= 8) return 'Q2'; // 1 Jul – 30 Sep (Q2 FY)
  if (month >= 9 && month <= 11) return 'Q3'; // 1 Oct – 31 Dec (Q3 FY)
  return 'Q4'; // 1 Jan – 31 Mar (Q4 FY)
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Converts a numeric amount to natural Indian words (crore, lakh, thousand, rupees)
 * e.g. 657062 -> "6 lakh 57 thousand 62 rupees"
 */
export function numberToIndianWords(amount: number): string {
  const isNegative = amount < 0;
  const n = Math.abs(Math.round(Number(amount)));
  if (isNaN(n) || n === 0) return '0 rupees';
  if (n === 1) return isNegative ? 'minus 1 rupee' : '1 rupee';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${crore} crore`);
  if (lakh > 0) parts.push(`${lakh} lakh`);
  if (thousand > 0) parts.push(`${thousand} thousand`);
  if (remainder > 0) {
    parts.push(`${remainder}`);
  }

  const prefix = isNegative ? 'minus ' : '';
  return `${prefix}${parts.join(' ')} rupees`;
}

/**
 * Replaces Indian currency expressions (₹6,57,062.12 or Rs. 24,630) into natural words for speech synthesis
 */
export function sanitizeIndianCurrencyForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/gi, (match, numStr) => {
      const cleanNum = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(cleanNum)) return match;
      return numberToIndianWords(cleanNum);
    })
    .replace(/([\d,]+(?:\.\d+)?)\s*(?:rupees|rupee)\b/gi, (match, numStr) => {
      const cleanNum = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(cleanNum)) return match;
      return numberToIndianWords(cleanNum);
    });
}
