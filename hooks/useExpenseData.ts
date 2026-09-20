import { useState, useEffect, useCallback } from 'react';

export interface ExpenseMetric {
  totalExpense: number;
  highestCategory: { name: string; amount: number; percentage: number };
  recordsCount: number;
  categoriesCount: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  momVariance: number;
  momPercentage: string;
  projectedNextMonth: string;
}

export interface TrendItem {
  month: string;
  amount: number;
}

export interface CategoryData {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  transactions: any[];
}

export function useExpenseData(initialDateRange: string = 'all', refreshTrigger?: any) {
  const [dateRange, setDateRange] = useState<string>(initialDateRange);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<ExpenseMetric>({
    totalExpense: 0,
    highestCategory: { name: 'Salary', amount: 0, percentage: 0 },
    recordsCount: 0,
    categoriesCount: 0,
    thisMonthTotal: 0,
    lastMonthTotal: 0,
    momVariance: 0,
    momPercentage: '0',
    projectedNextMonth: '₹0L',
  });

  const [categoriesData, setCategoriesData] = useState<CategoryData[]>([]);
  const [trendLine, setTrendLine] = useState<TrendItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<CategoryData | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/expenses?dateRange=${dateRange}`);
      const json = await res.json();
      if (json.success) {
        const totalVal = json.summary?.totalExpense || 0;
        const catMap: Record<string, { amount: number; count: number; transactions: any[] }> = json.categories || {};

        // Compute real dynamic categories from actual transactions in database
        const cats: CategoryData[] = Object.entries(catMap)
          .map(([name, data]) => {
            const amount = data.amount || 0;
            const pct = totalVal > 0 ? (amount / totalVal) * 100 : 0;
            return {
              name,
              amount: Math.round(amount * 100) / 100,
              count: data.count || 0,
              percentage: Math.round(pct),
              transactions: data.transactions || [],
            };
          })
          .filter((c) => c.amount > 0 || c.count > 0)
          .sort((a, b) => b.amount - a.amount);

        setMetrics({
          ...json.summary,
          categoriesCount: cats.length,
          highestCategory: cats[0]
            ? { name: cats[0].name, amount: cats[0].amount, percentage: cats[0].percentage }
            : (json.summary?.highestCategory || { name: 'None', amount: 0, percentage: 0 }),
        });

        setCategoriesData(cats);
        setTrendLine(json.trendLineData || []);
      }
    } catch (err) {
      console.error('Error fetching expense data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshTrigger]);

  // Listen to global custom event for instant cross-component updates
  useEffect(() => {
    const handleGlobalUpdate = () => {
      fetchExpenses();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('finance-data-updated', handleGlobalUpdate);
      return () => window.removeEventListener('finance-data-updated', handleGlobalUpdate);
    }
  }, [fetchExpenses]);

  return {
    dateRange,
    setDateRange,
    loading,
    metrics,
    categoriesData,
    trendLine,
    activeCategory,
    setActiveCategory,
    drillDownCategory,
    setDrillDownCategory,
    refresh: fetchExpenses,
  };
}
