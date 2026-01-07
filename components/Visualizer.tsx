import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { CalculationResult } from '../types';
import { formatCurrency, formatPercentage } from '../utils/calculator';
import { TrendingUp, Award, Table as TableIcon } from 'lucide-react';
import { DataTable } from './DataTable';

interface VisualizerProps {
  data: CalculationResult;
}

export const Visualizer: React.FC<VisualizerProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <div className="h-full flex flex-col space-y-4 md:space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 shrink-0">
        <StatCard 
          label="期末总资产" 
          value={formatCurrency(data.finalBalance)} 
          subtext={`实际年化 ${formatPercentage(data.effectiveAnnualRate)}`}
          highlight
        />
        <StatCard 
          label="投入本金" 
          value={formatCurrency(data.totalPrincipal)} 
          subtext={`占比 ${(data.totalPrincipal / data.finalBalance * 100).toFixed(1)}%`}
        />
        <StatCard 
          label="累计利息收益" 
          value={formatCurrency(data.totalInterest)} 
          subtext={`占比 ${(data.totalInterest / data.finalBalance * 100).toFixed(1)}%`}
          isPositive
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-850 rounded-3xl border border-slate-700 p-4 md:p-6 shadow-2xl flex flex-col relative min-h-[400px]">
        {/* Toggle Switch - Positioned to not overlap header */}
        <div className="flex justify-between items-center mb-6 z-20">
          <div className="flex items-center gap-2">
            {data.crossoverYear && viewMode === 'chart' && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                <Award size={14} className="text-amber-400" />
                <span className="text-[10px] md:text-xs font-semibold text-amber-300">
                  黄金交叉: 第 {data.crossoverYear} 年
                </span>
              </div>
            )}
          </div>
          
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-xl scale-90 md:scale-100 origin-right">
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                viewMode === 'chart' 
                  ? 'bg-slate-700 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp size={14} /> 图表
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${
                viewMode === 'table' 
                  ? 'bg-slate-700 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon size={14} /> 清单
            </button>
          </div>
        </div>

        {viewMode === 'chart' ? (
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.yearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                <XAxis 
                  dataKey="year" 
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  tickFormatter={(val) => `${val/10000}w`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="totalPrincipal" 
                  stackId="1" 
                  stroke="#38bdf8" 
                  fill="url(#colorPrincipal)" 
                  name="本金"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="totalInterest" 
                  stackId="1" 
                  stroke="#10b981" 
                  fill="url(#colorInterest)" 
                  name="收益"
                  strokeWidth={2}
                />
                {data.crossoverYear && (
                  <ReferenceLine x={data.crossoverYear} stroke="#f59e0b" strokeDasharray="3 3" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <DataTable data={data.yearlyData} />
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subtext, highlight, isPositive }: any) => (
  <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between h-24 md:h-28 relative overflow-hidden group transition-all duration-300 ${
    highlight 
      ? 'bg-brand-900/20 border-brand-500/50 shadow-[0_0_20px_rgba(2,132,199,0.15)]' 
      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
  }`}>
    {highlight && <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl"></div>}
    
    <span className="text-slate-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider z-10">{label}</span>
    
    <div className="z-10">
      <div className={`text-xl md:text-2xl lg:text-3xl font-bold font-mono tracking-tight ${
        highlight ? 'text-white' : isPositive ? 'text-emerald-400' : 'text-slate-200'
      }`}>
        {value}
      </div>
      <div className="text-[10px] md:text-xs text-slate-500 mt-0.5 font-medium">
        {subtext}
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const principal = payload[0].value;
    const interest = payload[1].value;
    const total = principal + interest;
    
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl min-w-[160px]">
        <p className="text-slate-400 mb-2 font-mono text-[10px]">第 {label} 年</p>
        <p className="text-white font-bold text-base mb-2 flex justify-between items-center">
          <span>{formatCurrency(total)}</span>
        </p>
        <div className="space-y-1 text-xs border-t border-slate-700/50 pt-2">
          <div className="flex justify-between text-brand-400">
            <span className="opacity-70">本金</span>
            <span className="font-mono">{formatCurrency(principal)}</span>
          </div>
          <div className="flex justify-between text-emerald-400">
            <span className="opacity-70">收益</span>
            <span className="font-mono">{formatCurrency(interest)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};