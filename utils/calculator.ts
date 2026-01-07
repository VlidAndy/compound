import { CalculationResult, YearlyData } from '../types';

/**
 * Calculates compound interest with monthly contributions and compounding.
 * @param initial Initial principal amount
 * @param monthly Monthly contribution
 * @param rate Annual interest rate (percentage)
 * @param years Duration in years
 */
export const calculateCompoundInterest = (
  initial: number,
  monthly: number,
  rate: number,
  years: number
): CalculationResult => {
  const months = years * 12;
  const monthlyRate = rate / 100 / 12;
  
  // Effective Annual Rate formula: (1 + r/n)^n - 1
  const effectiveAnnualRate = (Math.pow(1 + monthlyRate, 12) - 1) * 100;

  let currentBalance = initial;
  let totalContributed = initial;
  let totalInterestEarned = 0;
  let crossoverYear: number | null = null;
  
  const dataPoints: YearlyData[] = [];

  // Add Year 0 point
  dataPoints.push({
    year: 0,
    totalPrincipal: initial,
    totalInterest: 0,
    balance: initial,
    yearlyInterest: 0
  });

  let previousYearBalance = initial;

  for (let m = 1; m <= months; m++) {
    // Interest is applied to the balance at start of month
    const interest = currentBalance * monthlyRate;
    
    currentBalance += interest;
    currentBalance += monthly;
    totalContributed += monthly;
    totalInterestEarned += interest;

    // Check for yearly aggregation
    if (m % 12 === 0) {
      const currentYear = m / 12;
      
      // Golden Crossover Check: When cumulative interest exceeds cumulative principal
      if (crossoverYear === null && totalInterestEarned > totalContributed) {
        crossoverYear = currentYear;
      }

      dataPoints.push({
        year: currentYear,
        totalPrincipal: Math.round(totalContributed),
        totalInterest: Math.round(totalInterestEarned),
        balance: Math.round(currentBalance),
        yearlyInterest: Math.round(currentBalance - previousYearBalance - (monthly * 12))
      });
      
      previousYearBalance = currentBalance;
    }
  }

  return {
    yearlyData: dataPoints,
    finalBalance: Math.round(currentBalance),
    totalPrincipal: Math.round(totalContributed),
    totalInterest: Math.round(totalInterestEarned),
    effectiveAnnualRate,
    crossoverYear
  };
};

export const formatCurrency = (val: number, decimals: number = 0) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

export const formatPercentage = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val / 100);
};