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

export type AppTool = 'calculator' | 'allocation';