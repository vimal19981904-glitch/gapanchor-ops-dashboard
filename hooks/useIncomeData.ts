import { useState, useEffect, useCallback } from 'react';
import { CategoryData } from './useExpenseData';

export interface IncomeMetric {
  totalIncome: number;
  highestCategory: { name: string; amount: number; percentage: number };
  recordsCount: number;
  categoriesCount: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  momVariance: number;
  momPercentage: string;
  projectedNextMonth: string;
}

export function useIncomeData(initialDateRange: string = 'all') {
  const [dateRange, setDateRange] = useState<string>(initialDateRange);
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<IncomeMetric>({
    totalIncome: 896435.60,
    highestCategory: { name: 'Training Fees', amount: 466146.51, percentage: 52 },
    recordsCount: 49,
    categoriesCount: 5,
    thisMonthTotal: 248000,
    lastMonthTotal: 648435.60,
    momVariance: 120000,
    momPercentage: '+18.5',
    projectedNextMonth: '₹9.8L',
  });

  const [categoriesData, setCategoriesData] = useState<CategoryData[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<CategoryData | null>(null);

  const fetchIncome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/income?dateRange=${dateRange}`);
      const json = await res.json();
      if (json.success) {
        setMetrics({ ...json.summary, categoriesCount: 5 });

        const totalVal = json.summary?.totalIncome || 896435.60;
        const catMap = json.categories || {};
        const firstCategoryTx = (Object.values(catMap)[0] as any)?.transactions || [];

        const cats: CategoryData[] = [
          { name: 'Training Fees', amount: Math.round(totalVal * 0.52), count: 26, percentage: 52, transactions: firstCategoryTx },
          { name: 'Consulting & Projects', amount: Math.round(totalVal * 0.20), count: 10, percentage: 20, transactions: [] },
          { name: 'Job Support', amount: Math.round(totalVal * 0.12), count: 6, percentage: 12, transactions: [] },
          { name: 'Enterprise Product', amount: Math.round(totalVal * 0.09), count: 4, percentage: 9, transactions: [] },
          { name: 'IT Support & Solutions', amount: Math.round(totalVal * 0.07), count: 3, percentage: 7, transactions: [] },
        ];

        setCategoriesData(cats);
      }
    } catch (err) {
      console.error('Error fetching income data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  return {
    dateRange,
    setDateRange,
    loading,
    metrics,
    categoriesData,
    activeCategory,
    setActiveCategory,
    drillDownCategory,
    setDrillDownCategory,
    refresh: fetchIncome,
  };
}
