
export interface YearlyData {
  year: number;
  totalPrincipal: number; 
  totalInterest: number;  
  balance: number;        
  yearlyInterest: number; 
}

export interface CalculationResult {
  yearlyData: YearlyData[];
  finalBalance: number;
  totalPrincipal: number;
  totalInterest: number;
  effectiveAnnualRate: number; 
  crossoverYear: number | null; 
}

export interface InputState {
  initialPrincipal: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
}

export interface AssetItem {
  id: string;
  name: string;
  amount: number;
  color: string;
}

export type FundCategory = 'gold' | 'stock' | 'bond' | 'cash';
export type TransactionType = 'buy' | 'sell' | 'reinvest';

export interface Transaction {
  id: string;
  code: string;
  name: string;
  type: TransactionType;
  category: FundCategory;
  units: number;
  amount?: number; // 新增：实际成交的现金总额
  date: string; // YYYY-MM-DD
  timingAlpha?: number; // 择时收益 (对比周一基准)
}

export interface NAVPoint {
  timestamp: number;
  nav: number;
}

export interface Holding {
  code: string;
  name: string;
  category: FundCategory;
  totalUnits: number;
  avgCost: number;
  currentNAV: number;
  history: NAVPoint[];
  transactions: Transaction[];
}

export type AppTool = 'calculator' | 'allocation' | 'holdings' | 'strategy' | 'news';
