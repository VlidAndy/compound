import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer, Edit3, Save, Clock, RefreshCw, Calendar } from 'lucide-react';
import { Transaction, Holding, FundCategory, NAVPoint } from '../types';
import { fetchRealtimeValuation, findMondayBaseline, getCategoryName } from '../utils/fundApi';
import { formatCurrency } from '../utils/calculator';

interface StrategyDecision {
  code: string;
  name: string;
  category: FundCategory;
  suggestedAmount: number;
  actualAmount: number; // 仅用于内部看板比例预览，不存入交易记录
  actualUnits: number;
  date: string; 
  timingGap: number; 
  mondayNAV: number;
  currentNAV: number;
}

export const StrategyEngine: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fund_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [navData, setNavData] = useState<Record<string, NAVPoint[]>>({});
  const [budget, setBudget] = useState<200 | 300>(200);
  const [realtimeData, setRecordRealtime] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [userSelectedCodes, setUserSelectedCodes] = useState<Record<string, string>>({});
  const [editableDecisions, setEditableDecisions] = useState<StrategyDecision[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('fund_nav_cache');
    if (saved) setNavData(JSON.parse(saved));
  }, []);

  const holdings = useMemo(() => {
    const map = new Map<string, Holding>();
    transactions.forEach(t => {
      if (!map.has(t.code)) {
        map.set(t.code, {
          code: t.code,
          name: t.name,
          category: t.category,
          totalUnits: 0,
          avgCost: 0,
          currentNAV: 1.0,
          history: navData[t.code] || [],
          transactions: []
        });
      }
      const h = map.get(t.code)!;
      if (t.type === 'buy' || t.type === 'reinvest') h.totalUnits += t.units;
      else if (t.type === 'sell') h.totalUnits -= t.units;
    });
    return Array.from(map.values()).filter(h => h.totalUnits > 0);
  }, [transactions, navData]);

  const holdingsByCategory = useMemo(() => {
    const groups: Record<string, Holding[]> = { stock: [], bond: [], gold: [], cash: [] };
    holdings.forEach(h => {
      if (groups[h.category]) groups[h.category].push(h);
    });
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
    const targetHoldings = holdings.filter(h => h.category !== 'cash' && h.code !== 'CASH');
    const codes: string[] = Array.from(new Set(targetHoldings.map(h => h.code)));
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
    const nextIndex = (currentIndex + 1) % available.length;
    const nextFund = available[nextIndex];
    setUserSelectedCodes(prev => ({ ...prev, [category]: nextFund.code }));
  };

  useEffect(() => {
    if (holdings.length === 0) return;

    const selectedPerCategory: Partial<Record<FundCategory, Holding>> = {};
    (['stock', 'bond', 'gold', 'cash'] as FundCategory[]).forEach(cat => {
      const available = holdingsByCategory[cat];
      if (available.length === 0) return;
      const userChoice = userSelectedCodes[cat];
      const found = userChoice ? available.find(h => h.code === userChoice) : null;
      if (found) {
        selectedPerCategory[cat] = found;
      } else {
        selectedPerCategory[cat] = [...available].sort((a, b) => b.totalUnits - a.totalUnits)[0];
      }
    });

    const totalValue = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
    const targetValue = parseFloat(((totalValue + budget) / 4).toFixed(2)); 
    let remainingBudget: number = budget;
    const initialDecisions: StrategyDecision[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultConfirmDate = tomorrow.toISOString().split('T')[0];

    const gaps = (['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => ({
      cat,
      gap: Math.max(0, targetValue - categoryValues[cat])
    })).sort((a, b) => b.gap - a.gap);

    for (const g of gaps) {
      if (remainingBudget <= 0) break;
      const h = selectedPerCategory[g.cat];
      if (!h) continue;
      
      let give = Math.min(remainingBudget, g.gap);
      if (give > 0) {
        const roundedAmount = parseFloat(give.toFixed(2));
        if (roundedAmount <= 0) continue;

        const baseline = findMondayBaseline(h.history);
        const mondayPrice = baseline?.nav || (h.history.length > 0 ? h.history[0].nav : 1.0);
        const currentPrice = realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : mondayPrice);
        const gapPct = h.category === 'cash' ? 0 : (mondayPrice !== 0 ? (currentPrice - mondayPrice) / mondayPrice : 0);

        initialDecisions.push({
          code: h.code, name: h.name, category: h.category,
          suggestedAmount: roundedAmount, actualAmount: roundedAmount,
          actualUnits: parseFloat((roundedAmount / currentPrice).toFixed(2)),
          date: defaultConfirmDate,
          timingGap: gapPct, mondayNAV: mondayPrice, currentNAV: currentPrice
        });
        remainingBudget = parseFloat((remainingBudget - roundedAmount).toFixed(2));
      }
    }
    setEditableDecisions(initialDecisions);
  }, [holdings.length, budget, realtimeData, userSelectedCodes]);

  const updateDecisionField = (index: number, field: keyof StrategyDecision, value: any) => {
    const next = [...editableDecisions];
    next[index] = { ...next[index], [field]: value };
    // 更新预览用的 amount
    if (field === 'actualUnits') {
      next[index].actualAmount = parseFloat((Number(value) * next[index].currentNAV).toFixed(2));
    }
    setEditableDecisions(next);
  };

  const handleConfirmDCA = () => {
    const newTxs: Transaction[] = editableDecisions.map(d => ({
      id: `dca-${Date.now()}-${d.code}`,
      code: d.code,
      name: d.name,
      type: 'buy',
      category: d.category,
      units: d.actualUnits,
      date: d.date, // 存入确认日期，Holdings 将根据此日期追溯 T日净值
    }));

    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    localStorage.setItem('fund_transactions', JSON.stringify(updated));
    alert(`入库成功！\n请在“我的持仓”中点击“全量同步”以更新成交成本。`);
  };

  // Fix: Define globalSignal based on timingGap in editableDecisions
  const globalSignal = useMemo(() => {
    if (editableDecisions.length === 0) return 'normal';
    const minGap = Math.min(...editableDecisions.map(d => d.timingGap));
    if (minGap < -0.01) return 'high';
    if (minGap < 0.005) return 'good';
    return 'normal';
  }, [editableDecisions]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
      <div className={`p-8 rounded-[2.5rem] relative overflow-hidden border-2 transition-all duration-700 ${
        globalSignal === 'high' ? 'bg-emerald-950/40 border-emerald-400' :
        globalSignal === 'good' ? 'bg-blue-950/40 border-brand-500' :
        'bg-orange-950/30 border-orange-500/50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-3">
            <h2 className="text-3xl md:text-5xl font-black text-white flex items-baseline gap-4 tracking-tight">
              {globalSignal === 'high' ? '触发加码补仓' : globalSignal === 'good' ? '择时窗口开启' : '价格高位区间'}
              <span className="text-sm font-mono opacity-40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Budget: ¥{budget}
              </span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              算法已自动计算各项资产距离“均衡占比 25%”的资金缺口，并结合本周一基准价进行了择时评估。
            </p>
          </div>
          <div className="flex bg-slate-900/90 p-2 rounded-[1.5rem] border border-white/10 shadow-2xl h-fit">
            {[200, 300].map(val => (
              <button
                key={val}
                onClick={() => setBudget(val as 200 | 300)}
                className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${budget === val ? 'bg-brand-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ¥{val}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 space-y-8 backdrop-blur-xl h-fit">
          <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
            <Zap size={16} className="text-amber-400" /> Portfolio Rebalance
          </h3>
          <div className="space-y-6">
            {(['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => {
              const currentVal = categoryValues[cat];
              const totalVal = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
              const currentPct = totalVal > 0 ? (currentVal / totalVal) * 100 : 0;
              const addedVal = editableDecisions.filter(d => d.category === cat).reduce((a,b) => a + b.actualAmount, 0);
              const targetPct = totalVal > 0 ? ((currentVal + addedVal) / (totalVal + budget)) * 100 : 25;
              return (
                <div key={cat} className="group">
                  <div className="flex justify-between text-xs font-bold mb-3">
                    <span className="text-slate-500">{getCategoryName(cat)}</span>
                    <span className="text-white font-mono flex items-center gap-2">
                      {currentPct.toFixed(1)}% <ArrowRight size={10} className="text-slate-700" /> <span className="text-brand-400">{targetPct.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div className="h-full" style={{ width: `${currentPct}%`, backgroundColor: CATEGORY_COLORS[cat] }} />
                    <div className="h-full bg-white/10 animate-pulse" style={{ width: `${Math.max(0, targetPct - currentPct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl">
           <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
             <h3 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-3">
               <ShoppingCart size={16} className="text-brand-400" /> Order Confirmation
             </h3>
             <button onClick={syncMarket} disabled={isSyncing} className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition-all">
                <Activity size={12} className={isSyncing ? 'animate-spin' : ''} /> REFRESH QUOTE
             </button>
           </div>
           <div className="p-8 space-y-6 flex-1 overflow-auto custom-scrollbar">
             {editableDecisions.map((d, idx) => (
               <div key={d.code} className="bg-slate-800/40 border border-white/5 p-6 rounded-3xl">
                 <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                    <div className="flex items-center gap-4 min-w-[200px]">
                       <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.category] }}></div>
                       <div>
                         <div className="text-lg font-black text-white flex items-center gap-2">
                           {d.name}
                           {holdingsByCategory[d.category].length > 1 && <button onClick={() => handleSwapFund(d.category)} className="p-1 hover:text-brand-400"><RefreshCcw size={12}/></button>}
                         </div>
                         <div className="text-[10px] font-mono text-slate-500">{d.code} · Gap: {(d.timingGap * 100).toFixed(2)}%</div>
                       </div>
                    </div>
                    <div className="flex flex-1 gap-4 justify-end">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">确认日期 (T+1)</label>
                          <input type="date" value={d.date} onChange={e => updateDecisionField(idx, 'date', e.target.value)} className="bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-xs font-mono text-white outline-none focus:border-brand-500" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">成交份额</label>
                          <input type="number" step="0.01" value={d.actualUnits} onChange={e => updateDecisionField(idx, 'actualUnits', parseFloat(e.target.value))} className="bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-brand-500 w-32" />
                       </div>
                    </div>
                 </div>
               </div>
             ))}
             <button onClick={handleConfirmDCA} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-[0.98]">
                <Save size={24} /> 确认入库并锁定资产
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const CATEGORY_COLORS: Record<string, string> = { stock: '#ef4444', bond: '#38bdf8', gold: '#fbbf24', cash: '#34d399' };