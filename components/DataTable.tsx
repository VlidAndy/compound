import React from 'react';
import { YearlyData } from '../types';
import { formatCurrency } from '../utils/calculator';

interface DataTableProps {
  data: YearlyData[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  return (
    <div className="flex-1 w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/40">
      <div className="h-full overflow-auto custom-scrollbar">
        <div className="min-w-[600px]">
          <table className="w-full text-xs md:text-sm text-left text-slate-400 border-collapse">
            <thead className="text-[10px] md:text-xs uppercase bg-slate-800 text-slate-300 sticky top-0 z-10 shadow-md">
              <tr>
                <th className="px-4 md:px-6 py-3 font-semibold border-b border-slate-700">年份</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-right border-b border-slate-700">总本金</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-right border-b border-slate-700">总收益</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-right border-b border-slate-700">当年收益</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-right text-white border-b border-slate-700">总资产</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30 font-mono">
              {data.map((row) => (
                <tr key={row.year} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 md:px-6 py-3 font-sans font-medium text-slate-300">{row.year}</td>
                  <td className="px-4 md:px-6 py-3 text-right">{formatCurrency(row.totalPrincipal)}</td>
                  <td className="px-4 md:px-6 py-3 text-right text-emerald-500/80">{formatCurrency(row.totalInterest)}</td>
                  <td className="px-4 md:px-6 py-3 text-right text-emerald-500/50">+{formatCurrency(row.yearlyInterest)}</td>
                  <td className="px-4 md:px-6 py-3 text-right text-white font-bold">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};