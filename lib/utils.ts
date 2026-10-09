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
