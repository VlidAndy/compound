
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer, Edit3, Save, Clock, RefreshCw, Calendar, Globe, ExternalLink, ShieldCheck, Landmark, Target, Trophy, Percent, Flame, ArrowDownToLine, MousePointerClick, BarChart4, Scale, PieChart as PieIcon, Layers } from 'lucide-react';
import { Transaction, Holding, FundCategory, NAVPoint } from '../types';
import { fetchRealtimeValuation, findMondayBaseline, getCategoryName } from '../utils/fundApi';
import { formatCurrency } from '../utils/calculator';

interface StrategyDecision {
  code: string;
  name: string;
  category: FundCategory;
  suggestedAmount: number;
  actualUnits: number;
  date: string; 
  mondayNAV: number;
  currentNAV: number;
  avgCost: number;       
  discountIndex: number; 
}

const CATEGORY_COLORS: Record<string, string> = {
  stock: '#ef4444',
  bond: '#38bdf8',
  gold: '#fbbf24',
  cash: '#34d399'
};

export const StrategyEngine: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fund_transactions');
    return saved ? (JSON.parse(saved) as Transaction[]) : [];
  });
  
  const [targetUnitsMap, setTargetUnitsMap] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('fund_target_units');
    return saved ? (JSON.parse(saved) as Record<string, number>) : {};
  });

  const [navData, setNavData] = useState<Record<string, NAVPoint[]>>({});
  const [budget, setBudget] = useState<number>(() => {
    const saved = localStorage.getItem('fund_dca_budget');
    return saved ? parseInt(saved) : 200;
  });
  const [realtimeData, setRecordRealtime] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [userSelectedCodes, setUserSelectedCodes] = useState<Record<string, string>>({});
  const [editableDecisions, setEditableDecisions] = useState<StrategyDecision[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('fund_nav_cache');
    if (saved) setNavData(JSON.parse(saved) as Record<string, NAVPoint[]>);
    localStorage.setItem('fund_dca_budget', budget.toString());
  }, [budget]);

  useEffect(() => {
    localStorage.setItem('fund_target_units', JSON.stringify(targetUnitsMap));
  }, [targetUnitsMap]);

  const holdings = useMemo(() => {
    const map = new Map<string, Holding>();
    transactions.forEach(t => {
      if (!map.has(t.code)) {
        map.set(t.code, {
          code: t.code, name: t.name, category: t.category, totalUnits: 0, avgCost: 0, currentNAV: 1.0, history: navData[t.code] || [], transactions: []
        });
      }
      const h = map.get(t.code)!;
      h.transactions.push(t);
      if (t.type === 'buy' || t.type === 'reinvest') h.totalUnits += t.units;
      else if (t.type === 'sell') h.totalUnits -= t.units;
    });

    map.forEach(h => {
      let totalCost = 0; let unitsForCalc = 0;
      const sortedTxs = [...h.transactions].sort((a,b) => a.date.localeCompare(b.date));
      sortedTxs.forEach(t => {
        if (t.type === 'buy') {
          const history = navData[t.code] || [];
          const confirmIndex = history.findIndex(p => new Date(p.timestamp).toISOString().split('T')[0] >= t.date);
          const price = t.amount && t.units ? t.amount / t.units : (confirmIndex > 0 ? history[confirmIndex-1].nav : (history.length > 0 ? history[0].nav : 1.0));
          totalCost += t.units * price; unitsForCalc += t.units;
        } else if (t.type === 'sell') {
          const costToReduce = unitsForCalc > 0 ? (t.units / unitsForCalc) * totalCost : 0;
          totalCost = Math.max(0, totalCost - costToReduce); unitsForCalc -= t.units;
        }
      });
      h.avgCost = unitsForCalc > 0.0001 ? totalCost / unitsForCalc : 0;
    });
    return Array.from(map.values()).filter(h => h.totalUnits > 0 || h.code === 'CASH');
  }, [transactions, navData]);

  const holdingsByCategory = useMemo(() => {
    const groups: Record<string, Holding[]> = { stock: [], bond: [], gold: [], cash: [] };
    holdings.forEach(h => { if (groups[h.category]) groups[h.category].push(h); });
    return groups;
  }, [holdings]);

  const categoryValues = useMemo(() => {
    const vals: Record<FundCategory, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };
    holdings.forEach(h => {
      const currentPrice = h.category === 'cash' ? 1.0 : (realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : 1.0));
      vals[h.category] += h.totalUnits * currentPrice;
    });
    return vals;
  }, [holdings, realtimeData]);

  const syncMarket = async () => {
    setIsSyncing(true);
    const codes: string[] = Array.from(new Set(holdings.filter(h => h.category !== 'cash').map(h => h.code)));
    const results: Record<string, number> = {};
    for (const code of codes) {
      const val = await fetchRealtimeValuation(code);
      if (val) results[code] = val;
    }
    setRecordRealtime(results);
    setIsSyncing(false);
  };

  const handleSwapFund = (category: FundCategory) => {
    const available = holdingsByCategory[category];
    if (available.length <= 1) return;
    const currentDecision = editableDecisions.find(d => d.category === category);
    if (!currentDecision) return;
    const currentIndex = available.findIndex(h => h.code === currentDecision.code);
    const nextFund = available[(currentIndex + 1) % available.length];
    setUserSelectedCodes(prev => ({ ...prev, [category]: nextFund.code }));
  };

  const weeklyAlphaStats = useMemo(() => {
    const stats: Record<FundCategory, { gap: number, code: string, name: string }> = {
      stock: { gap: 0, code: '', name: '' },
      bond: { gap: 0, code: '', name: '' },
      gold: { gap: 0, code: '', name: '' },
      cash: { gap: 0, code: '', name: '' }
    };
    (['stock', 'bond', 'gold', 'cash'] as FundCategory[]).forEach(cat => {
      const available = holdingsByCategory[cat];
      if (available.length === 0) return;
      const h = available.sort((a,b) => b.totalUnits - a.totalUnits)[0];
      const baseline = findMondayBaseline(h.history);
      const mondayPrice = baseline?.nav || (h.history.length > 0 ? h.history[0].nav : 1.0);
      const currentPrice = h.category === 'cash' ? 1.0 : (realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : mondayPrice));
      stats[cat] = {
        gap: mondayPrice !== 0 ? (currentPrice - mondayPrice) / mondayPrice : 0,
        code: h.code,
        name: h.name
      };
    });
    return stats;
  }, [holdingsByCategory, realtimeData]);

  // 计算再平衡比例变化数据 + 建议金额
  const rebalanceStats = useMemo(() => {
    const totalCurrentValue = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
    const totalNewValue = totalCurrentValue + budget;

    const stats = (['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => {
      const currentVal = categoryValues[cat];
      const addedVal = editableDecisions
        .filter(d => d.category === cat)
        .reduce((sum, d) => sum + (d.actualUnits * d.currentNAV), 0);
      
      const newVal = currentVal + addedVal;
      return {
        name: getCategoryName(cat),
        category: cat,
        beforePct: totalCurrentValue > 0 ? (currentVal / totalCurrentValue) * 100 : 0,
        afterPct: totalNewValue > 0 ? (newVal / totalNewValue) * 100 : 0,
        suggestedAmount: addedVal,
        color: CATEGORY_COLORS[cat]
      };
    });

    return { stats, totalCurrentValue, totalNewValue };
  }, [categoryValues, editableDecisions, budget]);

  useEffect(() => {
    if (holdings.length === 0) return;
    const totalValue = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
    const targetValue = parseFloat(((totalValue + budget) / 4).toFixed(2)); 
    let remainingBudget: number = budget;
    const initialDecisions: StrategyDecision[] = [];
    const today = new Date().toISOString().split('T')[0];

    const gaps = (['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => ({
      cat, gap: Math.max(0, targetValue - categoryValues[cat])
    })).sort((a, b) => b.gap - a.gap);

    for (const g of gaps) {
      if (remainingBudget <= 0) break;
      const available = holdingsByCategory[g.cat];
      if (available.length === 0) continue;
      const h = userSelectedCodes[g.cat] ? available.find(f => f.code === userSelectedCodes[g.cat])! : available[0];
      
      let give = Math.min(remainingBudget, g.gap);
      if (give > 0) {
        const roundedAmount = parseFloat(give.toFixed(2));
        const baseline = findMondayBaseline(h.history);
        const mondayPrice = baseline?.nav || (h.history.length > 0 ? h.history[0].nav : 1.0);
        const currentPrice = h.category === 'cash' ? 1.0 : (realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : mondayPrice));
        
        initialDecisions.push({
          code: h.code, name: h.name, category: h.category, suggestedAmount: roundedAmount,
          actualUnits: parseFloat((roundedAmount / currentPrice).toFixed(2)),
          date: today, 
          mondayNAV: mondayPrice, currentNAV: currentPrice, avgCost: h.avgCost,
          discountIndex: h.avgCost > 0 ? currentPrice / h.avgCost : 1.0
        });
        remainingBudget = parseFloat((remainingBudget - roundedAmount).toFixed(2));
      }
    }
    setEditableDecisions(initialDecisions);
  }, [holdings.length, budget, realtimeData, userSelectedCodes]);

  // 处理日期变更引起的买入价自动回溯逻辑
  const handleDateChange = (idx: number, newDate: string) => {
    const next = [...editableDecisions];
    const decision = next[idx];
    const holding = holdings.find(h => h.code === decision.code);
    
    if (!holding || holding.category === 'cash') {
      next[idx] = { ...decision, date: newDate };
      setEditableDecisions(next);
      return;
    }

    // 从历史 NAV 中寻找指定日期前的最后一个净值
    const history = holding.history;
    const confirmIndex = history.findIndex(p => new Date(p.timestamp).toISOString().split('T')[0] >= newDate);
    let newPrice = decision.currentNAV;

    if (confirmIndex > 0) {
      newPrice = history[confirmIndex - 1].nav;
    } else if (confirmIndex === 0) {
      newPrice = history[0].nav;
    } else if (history.length > 0) {
      newPrice = history[history.length - 1].nav;
    }

    next[idx] = { 
      ...decision, 
      date: newDate, 
      currentNAV: newPrice,
      actualUnits: parseFloat((decision.suggestedAmount / newPrice).toFixed(2)),
      discountIndex: decision.avgCost > 0 ? newPrice / decision.avgCost : 1.0
    };
    setEditableDecisions(next);
  };

  const globalSignal = useMemo(() => {
    const stockGap = weeklyAlphaStats.stock.gap;
    const goldGap = weeklyAlphaStats.gold.gap;
    if (stockGap <= -0.015 || goldGap <= -0.015) return 'high'; 
    if (stockGap < 0 || goldGap < 0) return 'good';
    return 'warning';
  }, [weeklyAlphaStats]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
      <div className={`p-8 rounded-[2.5rem] relative overflow-hidden border-2 ${
        globalSignal === 'high' ? 'bg-emerald-950/40 border-emerald-400' :
        globalSignal === 'good' ? 'bg-blue-950/40 border-brand-500' : 'bg-orange-950/30 border-orange-500/50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className={`text-brand-400 ${globalSignal === 'high' ? 'animate-bounce' : ''}`} size={20} />
              <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Strategy Center</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white flex items-baseline gap-4 tracking-tight">
              {globalSignal === 'high' ? '超比例吸纳信号' : globalSignal === 'good' ? '标准均衡定投' : '观察市场情绪'}
              <span className="text-sm font-mono opacity-40 bg-white/5 px-3 py-1 rounded-full border border-white/10">¥{budget}</span>
            </h2>
          </div>
          <div className="flex flex-col items-center gap-5">
             <div className="flex bg-slate-900/90 p-2 rounded-[1.5rem] border border-white/10 shadow-2xl">
               {[100, 200, 300, 500].map(val => (
                 <button key={val} onClick={() => setBudget(val)} className={`px-6 py-3 rounded-2xl text-xs font-black transition-all ${budget === val ? 'bg-brand-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}>¥{val}</button>
               ))}
             </div>
             <button onClick={syncMarket} disabled={isSyncing} className="group flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest">
               <Activity size={14} className={isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'} />
               {isSyncing ? 'Syncing...' : '刷新全市场估值'}
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. 资产再平衡精算面板 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 backdrop-blur-xl">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-xs">
                <div className="p-2 bg-brand-500/20 rounded-lg"><Scale size={16} className="text-brand-400" /></div>
                再平衡预估 (Balance Actuary)
             </h3>
             <div className="space-y-6">
                {rebalanceStats.stats.map(s => (
                  <div key={s.category} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 line-through font-mono">{s.beforePct.toFixed(1)}%</span>
                        <ArrowRight size={10} className="text-slate-700" />
                        <span className={`text-xs font-mono font-black ${Math.abs(s.afterPct - 25) < Math.abs(s.beforePct - 25) ? 'text-emerald-400' : 'text-white'}`}>
                          {s.afterPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                       <div className="h-full transition-all duration-1000" style={{ width: `${s.afterPct}%`, backgroundColor: s.color }} />
                    </div>
                    {s.suggestedAmount > 0 && (
                      <div className="flex justify-end">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">+ {formatCurrency(s.suggestedAmount, 2)}</span>
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>

          {/* 2. 资产类别周波动率面板 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 backdrop-blur-xl">
            <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-xs">
              <div className="p-2 bg-brand-500/20 rounded-lg"><BarChart4 size={16} className="text-brand-400" /></div>
              市场 Alpha 信号 (周波动率)
            </h3>
            <div className="space-y-6">
              {(['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => {
                const stat = weeklyAlphaStats[cat];
                const pct = stat.gap * 100;
                return (
                  <div key={cat} className="group">
                    <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-tighter">
                      <span className="text-slate-500">{getCategoryName(cat)}</span>
                      <span className={pct < 0 ? 'text-emerald-400' : 'text-rose-400'}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                      <div className={`absolute top-0 bottom-0 transition-all duration-700 ${pct < 0 ? 'bg-emerald-500 right-1/2' : 'bg-rose-500 left-1/2'}`} style={{ width: `${Math.min(50, Math.abs(pct) * 5)}%` }} />
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700 z-10" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 份额收割目标面板 */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 backdrop-blur-xl">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-xs">
                <div className="p-2 bg-amber-500/20 rounded-lg"><Target size={16} className="text-amber-400" /></div>
                收割进度
             </h3>
             <div className="space-y-5">
               {holdings.filter(h => h.category !== 'cash').map(h => {
                 const target = targetUnitsMap[h.code] || 10000;
                 const progress = Math.min(100, (h.totalUnits / target) * 100);
                 return (
                   <div key={h.code} className="space-y-2">
                     <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-slate-400">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <input type="number" value={target} onChange={e => setTargetUnitsMap({...targetUnitsMap, [h.code]: parseFloat(e.target.value)})} className="bg-transparent text-right w-16 text-[10px] font-mono font-bold text-brand-400 outline-none border-b border-white/5" />
                          <span className="text-[10px] text-slate-600">份</span>
                        </div>
                     </div>
                     <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: CATEGORY_COLORS[h.category] }} />
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>

        {/* 4. 执行决策列表：强化视觉与功能 */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] flex flex-col shadow-2xl backdrop-blur-xl overflow-hidden">
           <div className="p-8 border-b border-white/5 flex items-center justify-between">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
               <div className="p-2 bg-brand-500/20 rounded-lg"><ShoppingCart size={16} className="text-brand-400" /></div>
               本期收割清单
             </h3>
           </div>
           
           <div className="flex-1 overflow-auto custom-scrollbar p-8 space-y-6">
             {editableDecisions.length > 0 ? (
               editableDecisions.map((d, idx) => (
                 <div key={d.code} className={`p-8 rounded-[2rem] border transition-all relative ${d.discountIndex < 1 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/40 border-white/5'}`}>
                   <div className="flex flex-col xl:flex-row gap-8 items-start xl:items-center">
                      {/* 资产名 */}
                      <div className="flex items-center gap-4 min-w-[200px]">
                         <div className="w-2 h-12 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.category] }}></div>
                         <div>
                           <div className="flex items-center gap-2">
                             <div className="text-lg font-black text-white">{d.name}</div>
                             {holdingsByCategory[d.category].length > 1 && (
                               <button onClick={() => handleSwapFund(d.category)} className="p-1 text-slate-600 hover:text-brand-400 transition-colors">
                                 <RefreshCw size={12} />
                               </button>
                             )}
                           </div>
                           <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">{d.code}</div>
                         </div>
                      </div>

                      {/* 关键精算指标 - 重构竖向排列布局 */}
                      <div className="grid grid-cols-3 gap-8 flex-1 w-full">
                         <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest border-l-2 border-slate-700 pl-2">摊薄成本</span>
                            <div className="text-lg font-mono font-black text-slate-300">
                              {d.avgCost.toFixed(4)}
                            </div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest border-l-2 border-slate-700 pl-2">实时买入</span>
                            <div className="text-lg font-mono font-black text-white">
                              {d.currentNAV.toFixed(4)}
                            </div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest border-l-2 border-slate-700 pl-2">折扣指数</span>
                            <div className={`text-lg font-mono font-black ${d.discountIndex < 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {(d.discountIndex * 100 - 100).toFixed(2)}%
                            </div>
                         </div>
                      </div>

                      {/* 交互控件 */}
                      <div className="flex gap-4 items-end w-full xl:w-auto">
                         <div className="space-y-2 flex-1 xl:flex-none">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">确认份额</label>
                            <input type="number" step="0.01" value={d.actualUnits} onChange={e => {
                              const val = parseFloat(e.target.value);
                              const next = [...editableDecisions];
                              next[idx] = { ...next[idx], actualUnits: val, suggestedAmount: val * d.currentNAV };
                              setEditableDecisions(next);
                            }} className="w-full xl:w-28 bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-brand-500 shadow-inner" />
                         </div>
                         <div className="space-y-2 flex-1 xl:flex-none">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">成交日期</label>
                            <input type="date" value={d.date} onChange={e => handleDateChange(idx, e.target.value)} className="w-full xl:w-40 bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-sm font-mono text-brand-400 outline-none focus:border-brand-500 shadow-inner" />
                         </div>
                      </div>
                   </div>
                   
                   {/* 折扣状态徽标 */}
                   {d.discountIndex < 1 && (
                     <div className="absolute top-4 right-6 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        <Flame size={12} className="text-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">Undervalued</span>
                     </div>
                   )}
                 </div>
               ))
             ) : (
               <div className="h-64 flex flex-col items-center justify-center text-slate-700 italic space-y-4">
                  <Layers size={48} className="opacity-10" />
                  <p className="text-sm">资产比例已均衡或无可用预算</p>
               </div>
             )}

             <button 
               onClick={() => {
                  const newTxs: Transaction[] = editableDecisions.map(d => ({
                    id: `dca-${Date.now()}-${d.code}`, 
                    code: d.code, 
                    name: d.name, 
                    type: 'buy', 
                    category: d.category, 
                    units: d.actualUnits, 
                    date: d.date,
                    amount: d.suggestedAmount
                  }));
                  const updated = [...transactions, ...newTxs];
                  setTransactions(updated);
                  localStorage.setItem('fund_transactions', JSON.stringify(updated));
                  alert(`批量收割完成！已记录 ${newTxs.length} 笔交易。`);
               }} 
               disabled={editableDecisions.length === 0}
               className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:grayscale text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-[0.98] mt-8 group"
             >
                <MousePointerClick size={24} className="group-hover:translate-y-1 transition-transform" /> 批量确认并入库
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
