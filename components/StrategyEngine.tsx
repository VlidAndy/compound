
import React, { useState, useEffect, useMemo } from 'react';
// Fix: Added 'Clock' to the imports from lucide-react
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer, Edit3, Save, Clock } from 'lucide-react';
import { Transaction, Holding, FundCategory, NAVPoint } from '../types';
import { fetchRealtimeValuation, findMondayBaseline, getCategoryName } from '../utils/fundApi';
import { formatCurrency } from '../utils/calculator';

interface StrategyDecision {
  code: string;
  name: string;
  category: FundCategory;
  suggestedAmount: number;
  actualAmount: number;   // 用户可编辑
  actualUnits: number;    // 用户可编辑（T+1确认后）
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
  const [realtimeData, setRealtimeData] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 用于存储用户在清单中编辑的临时状态
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
    setRealtimeData(results);
    setIsSyncing(false);
  };

  // 生成初始决策建议
  useEffect(() => {
    if (holdings.length === 0) return;

    const preferredPerCategory: Partial<Record<FundCategory, Holding>> = {};
    holdings.forEach(h => {
      const current = preferredPerCategory[h.category];
      if (!current || h.totalUnits > current.totalUnits) {
        preferredPerCategory[h.category] = h;
      }
    });

    const totalValue = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
    const targetValue = (totalValue + budget) / 4; 
    let remainingBudget = budget;
    const initialDecisions: StrategyDecision[] = [];

    const gaps = (['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => ({
      cat,
      gap: Math.max(0, targetValue - categoryValues[cat])
    })).sort((a, b) => b.gap - a.gap);

    for (const g of gaps) {
      if (remainingBudget <= 0) break;
      const h = preferredPerCategory[g.cat];
      if (!h) continue;
      const give = Math.min(remainingBudget, g.gap);
      if (give > 0) {
        if (h.category === 'cash') {
          initialDecisions.push({
            code: h.code, name: h.name, category: h.category,
            suggestedAmount: Math.round(give), actualAmount: Math.round(give),
            actualUnits: Math.round(give), // 货币基金份额通常等于金额
            timingGap: 0, mondayNAV: 1.0, currentNAV: 1.0
          });
        } else {
          const baseline = findMondayBaseline(h.history);
          const mondayPrice = baseline?.nav || (h.history.length > 0 ? h.history[0].nav : 1.0);
          const currentPrice = realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : mondayPrice);
          const gapPct = mondayPrice !== 0 ? (currentPrice - mondayPrice) / mondayPrice : 0;

          initialDecisions.push({
            code: h.code, name: h.name, category: h.category,
            suggestedAmount: Math.round(give), actualAmount: Math.round(give),
            actualUnits: parseFloat((give / currentPrice).toFixed(2)),
            timingGap: gapPct, mondayNAV: mondayPrice, currentNAV: currentPrice
          });
        }
        remainingBudget -= give;
      }
    }
    if (remainingBudget > 0 && initialDecisions.length > 0) {
      initialDecisions[0].suggestedAmount += remainingBudget;
      initialDecisions[0].actualAmount += remainingBudget;
    }
    setEditableDecisions(initialDecisions);
  }, [holdings.length, budget, realtimeData]); // 当 budget 或实时行情变化时刷新建议

  const globalSignal = useMemo(() => {
    const stockGap = editableDecisions.find(d => d.category === 'stock')?.timingGap || 0;
    const goldGap = editableDecisions.find(d => d.category === 'gold')?.timingGap || 0;
    // 条件：跌幅超过 1.5% 触发高亮建议
    if (stockGap <= -0.015 || goldGap <= -0.015) return 'high'; 
    if (stockGap < 0 || goldGap < 0) return 'good';
    return 'warning';
  }, [editableDecisions]);

  const updateDecisionField = (index: number, field: 'actualAmount' | 'actualUnits', value: number) => {
    const next = [...editableDecisions];
    next[index] = { ...next[index], [field]: value };
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
      date: new Date().toISOString().split('T')[0],
      // Alpha收益计算：(周一价格 - 实际价格) * 确认份额
      // 实际上：周一价格 * 份额 - 实际花费金额
      timingAlpha: (d.mondayNAV * d.actualUnits) - d.actualAmount
    }));

    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    localStorage.setItem('fund_transactions', JSON.stringify(updated));
    
    const totalAlpha = newTxs.reduce((a, b) => a + (b.timingAlpha || 0), 0);
    // Fix: Replaced undefined variable 'd' with a sum of 'actualAmount' from editableDecisions
    const totalActualAmount = editableDecisions.reduce((a, b) => a + b.actualAmount, 0);
    alert(`入库成功！\n实际记录成交金额：${formatCurrency(totalActualAmount, 2)}\n本周择时 Alpha 收益：${formatCurrency(totalAlpha, 2)}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
      {/* 状态卡片 */}
      <div className={`p-8 rounded-[2.5rem] relative overflow-hidden transition-all duration-700 border-2 ${
        globalSignal === 'high' ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_50px_rgba(52,211,153,0.15)]' :
        globalSignal === 'good' ? 'bg-blue-950/40 border-brand-500 shadow-[0_0_40px_rgba(14,165,233,0.1)]' :
        'bg-orange-950/30 border-orange-500/50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-ping ${globalSignal === 'high' ? 'bg-emerald-400' : 'bg-brand-400'}`}></div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Strategic Timing Analysis</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white flex items-baseline gap-4 tracking-tight">
              {globalSignal === 'high' ? '触发大幅回调加码' : globalSignal === 'good' ? '择时窗口开启' : '价格处于高位'}
              <span className="text-sm font-mono opacity-40 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                Limit: {budget} CNY
              </span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              {globalSignal === 'high' ? '大类资产偏离度突破 -1.5% 阈值。根据均值回归原理，此时增加投入（建议300元）能最大化摊薄长期成本。' : 
               globalSignal === 'good' ? '当前估值低于本周基准。虽然未达大幅回调标准，但仍属于择时正收益区间，建议按 200 元基准执行。' : 
               '当前估值高于周一。若非刚需平衡，可考虑仅执行极小额度或转入货币资产避险。'}
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-5">
             <div className="flex bg-slate-900/90 p-2 rounded-[1.5rem] border border-white/10 shadow-2xl">
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
             <button onClick={syncMarket} disabled={isSyncing} className="group flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest">
               <Activity size={14} className={`${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
               {isSyncing ? 'Synchronizing...' : 'Refresh Market Data'}
             </button>
          </div>
        </div>
        <div className={`absolute -right-20 -bottom-20 w-80 h-80 blur-[100px] rounded-full opacity-30 transition-colors duration-1000 ${
           globalSignal === 'high' ? 'bg-emerald-500' : 'bg-brand-500'
        }`}></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左侧：补平分析 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 space-y-8 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
                <div className="p-2 bg-amber-500/20 rounded-lg"><Zap size={16} className="text-amber-400" /></div>
                Portfolio Rebalance
              </h3>
              <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-mono text-[10px] border border-brand-500/20">Target 25%</span>
            </div>

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
                      <span className="text-slate-500 group-hover:text-slate-300 transition-colors">{getCategoryName(cat)}</span>
                      <span className="text-white font-mono flex items-center gap-2">
                        {currentPct.toFixed(1)}% 
                        <ArrowRight size={10} className="text-slate-700" /> 
                        <span className="text-brand-400">{targetPct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full transition-all duration-1000" style={{ width: `${currentPct}%`, backgroundColor: CATEGORY_COLORS[cat] }} />
                      <div className="h-full bg-white/10 animate-pulse" style={{ width: `${Math.max(0, targetPct - currentPct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-slate-900/40 p-6 rounded-[1.5rem] border border-slate-800/50 flex gap-4">
            <Info size={18} className="text-slate-600 shrink-0" />
            <p className="text-[11px] text-slate-500 leading-relaxed italic">
              算法提示：系统已锁定周一单位净值。择时 Alpha 仅在“实际买入价”低于“周一基准价”时为正。建议在 T+1 日确认份额后录入准确数据。
            </p>
          </div>
        </div>

        {/* 右侧：执行清单（可编辑） */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl">
           <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
               <div className="p-2 bg-brand-500/20 rounded-lg"><ShoppingCart size={16} className="text-brand-400" /></div>
               Pending DCA Orders
             </h3>
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Clock size={12} /> STATUS: DRAFTING
             </div>
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar p-8">
             {editableDecisions.length > 0 ? (
               <div className="space-y-6">
                 {editableDecisions.map((d, idx) => (
                   <div key={d.code} className="bg-slate-800/40 border border-white/5 p-6 rounded-3xl hover:border-white/10 transition-all">
                     <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                        <div className="flex items-center gap-4 min-w-[200px]">
                           <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.category] }}></div>
                           <div>
                             <div className="text-lg font-black text-white">{d.name}</div>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] font-mono text-slate-500">{d.code}</span>
                               {d.category !== 'cash' && (
                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${d.timingGap <= -0.015 ? 'bg-emerald-500/20 text-emerald-400' : d.timingGap < 0 ? 'bg-brand-500/20 text-brand-400' : 'bg-red-500/20 text-red-400'}`}>
                                   Gap: {(d.timingGap * 100).toFixed(2)}%
                                 </span>
                               )}
                             </div>
                           </div>
                        </div>

                        <div className="flex flex-1 flex-wrap md:flex-nowrap gap-4 justify-end">
                           <div className="space-y-1.5 min-w-[120px]">
                              <label className="text-[9px] uppercase font-black text-slate-600 block tracking-widest">实际成交金额</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">¥</span>
                                <input 
                                  type="number" 
                                  value={d.actualAmount} 
                                  onChange={e => updateDecisionField(idx, 'actualAmount', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-white/5 rounded-xl pl-7 pr-3 py-2.5 text-sm font-mono text-white focus:border-brand-500 outline-none"
                                />
                              </div>
                           </div>
                           <div className="space-y-1.5 min-w-[120px]">
                              <label className="text-[9px] uppercase font-black text-slate-600 block tracking-widest">确认份额 (T+1)</label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={d.actualUnits} 
                                  onChange={e => updateDecisionField(idx, 'actualUnits', parseFloat(e.target.value))}
                                  className="w-full bg-slate-900 border border-white/5 rounded-xl px-3 py-2.5 text-sm font-mono text-emerald-400 focus:border-brand-500 outline-none"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">份</span>
                              </div>
                           </div>
                        </div>
                     </div>
                   </div>
                 ))}
                 
                 <div className="pt-8 border-t border-white/5">
                    <button 
                      onClick={handleConfirmDCA}
                      className="w-full bg-brand-600 hover:bg-brand-500 text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl shadow-brand-500/20 transition-all active:scale-[0.98]"
                    >
                      <Save size={24} /> 确认入库并锁定 Alpha 收益
                    </button>
                    <div className="mt-6 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                       <div className="flex items-center gap-1"><Edit3 size={12} /> 手动核对</div>
                       <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                       <div className="flex items-center gap-1"><CheckCircle2 size={12} /> 真实持久化</div>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="h-64 flex flex-col items-center justify-center text-slate-700 italic space-y-4">
                 <div className="p-6 rounded-full bg-slate-800/20 border border-slate-800">
                   <Coins size={48} className="opacity-20" />
                 </div>
                 <p className="text-sm font-bold uppercase tracking-widest opacity-30">No Active Portfolio Found</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

const CATEGORY_COLORS: Record<string, string> = {
  stock: '#ef4444',
  bond: '#38bdf8',
  gold: '#fbbf24',
  cash: '#34d399'
};
