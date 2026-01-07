export interface YearlyData {
  year: number;
  totalPrincipal: number; // Initial + Monthly Contributions
  totalInterest: number;  // Earned Interest
  balance: number;        // Total Value
  yearlyInterest: number; // Interest earned just this year
}

export interface CalculationResult {
  yearlyData: YearlyData[];
  finalBalance: number;
  totalPrincipal: number;
  totalInterest: number;
  effectiveAnnualRate: number; // EAR
  crossoverYear: number | null; // The year interest exceeds principal
}

export interface InputState {
  initialPrincipal: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
}