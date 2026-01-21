
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer, Edit3, Save, Clock, RefreshCw, Calendar, Globe, ExternalLink, ShieldCheck, Landmark, Target, Trophy, Percent, Flame, ArrowDownToLine, MousePointerClick, BarChart4, Scale, PieChart as PieIcon, Layers, ZapIcon } from 'lucide-react';
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
  gold: '#f59e0b',
  cash: '#10b981'
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
        afterPct: totalNewValue > 0 ? (newVal / totalNewValue) * 100 : 25,
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

    // 核心变更：重新排列分配顺序，货币（Cash）作为最后选项
    // 1. 提取非货币资产并按缺口排序
    const priorityGaps = (['stock', 'gold', 'bond'] as FundCategory[]).map(cat => ({
      cat, gap: Math.max(0, targetValue - categoryValues[cat])
    })).sort((a, b) => b.gap - a.gap);

    // 2. 优先分配给高风险/投资类资产
    for (const g of priorityGaps) {
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

    // 3. 如果还有剩余预算，将其全部分配给货币类资产进行补齐
    if (remainingBudget > 0.01) {
      const available = holdingsByCategory['cash'];
      if (available.length > 0) {
        const h = userSelectedCodes['cash'] ? available.find(f => f.code === userSelectedCodes['cash'])! : available[0];
        initialDecisions.push({
          code: h.code, name: h.name, category: 'cash', 
          suggestedAmount: parseFloat(remainingBudget.toFixed(2)),
          actualUnits: parseFloat(remainingBudget.toFixed(2)),
          date: today,
          mondayNAV: 1.0, currentNAV: 1.0, avgCost: h.avgCost,
          discountIndex: h.avgCost > 0 ? 1.0 / h.avgCost : 1.0
        });
      }
    }
    
    setEditableDecisions(initialDecisions);
  }, [holdings.length, budget, realtimeData, userSelectedCodes]);

  const handleDateChange = (idx: number, newDate: string) => {
    const next = [...editableDecisions];
    const decision = next[idx];
    const holding = holdings.find(h => h.code === decision.code);
    
    if (!holding || holding.category === 'cash') {
      next[idx] = { ...decision, date: newDate };
      setEditableDecisions(next);
      return;
    }

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
      <div className={`p-8 rounded-[2.5rem] relative overflow-hidden border-2 transition-all duration-500 ${
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
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-xl">
             <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20">
                  <Scale size={20} className="text-brand-400" />
                </div>
                <h3 className="font-black text-white text-base tracking-tight">
                   再平衡预估 (BALANCE STATS)
                </h3>
             </div>

             <div className="space-y-10">
                {rebalanceStats.stats.map(s => (
                  <div key={s.category} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                        <span className="text-sm font-bold text-slate-200">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-xs text-slate-500 opacity-60 line-through">{s.beforePct.toFixed(1)}%</span>
                        <ArrowRight size={12} className="text-slate-600" />
                        <span className="text-sm font-black text-emerald-400">
                          {s.afterPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden">
                       <div 
                        className="h-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.1)]" 
                        style={{ width: `${s.afterPct}%`, backgroundColor: s.color }} 
                       />
                    </div>

                    <div className="flex justify-end">
                      <div className={`flex items-center gap-1.5 ${s.suggestedAmount > 0 ? 'text-emerald-400' : 'text-slate-600 opacity-40'}`}>
                        <ZapIcon size={12} fill="currentColor" stroke="none" />
                        <span className="text-[11px] font-black uppercase tracking-wider">
                          流入追加 {formatCurrency(s.suggestedAmount, 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>

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

        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] flex flex-col shadow-2xl backdrop-blur-xl overflow-hidden">
           <div className="p-8 border-b border-white/5 flex items-center justify-between">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
               <div className="p-2 bg-brand-500/10 rounded-lg"><ShoppingCart size={16} className="text-brand-400" /></div>
               本期收割清单
             </h3>
           </div>
           
           <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-8">
             {editableDecisions.length > 0 ? (
               editableDecisions.map((d, idx) => (
                 <div key={d.code} className={`p-6 md:p-8 rounded-[3rem] border-2 transition-all relative overflow-hidden ${d.discountIndex < 1 ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-slate-850/40 border-white/10'}`}>
                    {/* 背景装饰：折扣标识 */}
                    {d.discountIndex < 1 && (
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    )}
                    
                    <div className="flex flex-col space-y-8 relative z-10">
                      {/* 第一层：资产信息 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                           <div className="w-2 h-14 rounded-full shadow-lg" style={{ backgroundColor: CATEGORY_COLORS[d.category] }}></div>
                           <div>
                             <div className="flex items-center gap-3">
                               <h4 className="text-2xl font-black text-white tracking-tight">{d.name}</h4>
                               {holdingsByCategory[d.category].length > 1 && (
                                 <button onClick={() => handleSwapFund(d.category)} className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition-all" title="切换同类资产">
                                   <RefreshCw size={14} />
                                 </button>
                               )}
                             </div>
                             <p className="text-[11px] text-slate-500 font-mono mt-1 uppercase tracking-[0.2em]">{d.code} · {getCategoryName(d.category)}</p>
                           </div>
                        </div>
                        {d.discountIndex < 1 && (
                          <div className="px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center gap-2">
                             <Flame size={14} className="text-emerald-400 animate-pulse" />
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">低位机会</span>
                          </div>
                        )}
                      </div>

                      {/* 第二层：核心指标（精算卡片） */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 md:p-5 group/stat">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 group-hover/stat:text-brand-400 transition-colors">摊薄成本 (Cost)</span>
                          <div className="text-xl font-mono font-black text-slate-300 tracking-tighter">
                            {d.avgCost.toFixed(4)}
                          </div>
                        </div>
                        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 md:p-5 group/stat">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 group-hover/stat:text-brand-400 transition-colors">实时买入 (Buy)</span>
                          <div className="text-xl font-mono font-black text-white tracking-tighter">
                            {d.currentNAV.toFixed(4)}
                          </div>
                        </div>
                        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 md:p-5 group/stat">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 group-hover/stat:text-brand-400 transition-colors">折扣指数 (Ratio)</span>
                          <div className={`text-xl font-mono font-black flex items-center gap-2 tracking-tighter ${d.discountIndex < 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(d.discountIndex * 100 - 100).toFixed(2)}%
                            {d.discountIndex < 1 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* 第三层：操作输入（强制换行） */}
                      <div className="pt-2 border-t border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                               <MousePointerClick size={12} className="text-brand-400" /> 确认认购份额
                            </label>
                            <div className="relative group">
                              <input 
                                type="number" 
                                step="0.01" 
                                value={d.actualUnits} 
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  const next = [...editableDecisions];
                                  next[idx] = { ...next[idx], actualUnits: val, suggestedAmount: val * d.currentNAV };
                                  setEditableDecisions(next);
                                }} 
                                className="w-full bg-slate-950/80 border-2 border-white/5 rounded-[1.25rem] px-5 py-4 text-base font-mono font-black text-white outline-none focus:border-brand-500/50 shadow-inner transition-all"
                              />
                              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">份 (Units)</div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                               <Calendar size={12} className="text-brand-400" /> 指定成交日期
                            </label>
                            <div className="relative">
                              <input 
                                type="date" 
                                value={d.date} 
                                onChange={e => handleDateChange(idx, e.target.value)} 
                                className="w-full bg-slate-950/80 border-2 border-white/5 rounded-[1.25rem] px-5 py-4 text-base font-mono font-black text-brand-400 outline-none focus:border-brand-500/50 shadow-inner transition-all appearance-none"
                              />
                              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                                <ChevronRight size={18} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                 </div>
               ))
             ) : (
               <div className="py-24 flex flex-col items-center justify-center text-slate-700 italic space-y-6">
                  <div className="p-8 bg-slate-900/50 rounded-full border-2 border-dashed border-slate-800">
                    <Layers size={64} className="opacity-10" />
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-40">资产比例已均衡或无可用预算</p>
               </div>
             )}

             <div className="pt-6">
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
                 className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:grayscale text-white py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-5 shadow-2xl transition-all active:scale-[0.98] group"
               >
                  <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <MousePointerClick size={24} />
                  </div>
                  批量确认并入库 (COMMIT TRANSACTIONS)
               </button>
               <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-6">
                 确认后将自动更新“我的持仓”面板中的资产数据
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
