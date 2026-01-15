
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer, Edit3, Save, Clock, RefreshCw, Calendar, Globe, ExternalLink, ShieldCheck, Landmark } from 'lucide-react';
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
  timingGap: number; 
  mondayNAV: number;
  currentNAV: number;
}

const NEWS_SOURCES = [
  {
    category: 'stock',
    label: '权益市场',
    icon: TrendingUp,
    color: 'text-rose-400',
    links: [
      { name: '华尔街见闻-股市', url: 'https://wallstreetcn.com/news/shares' },
      { name: '东方财富网', url: 'https://www.eastmoney.com/' }
    ],
    desc: '关注经济增长预期与企业盈利能力。'
  },
  {
    category: 'bond',
    label: '债券利率',
    icon: Landmark,
    color: 'text-brand-400',
    links: [
      { name: '中债收益率曲线', url: 'https://www.chinabond.com.cn/' },
      { name: '英为财情-十年期美债', url: 'https://cn.investing.com/rates-bonds/u.s.-10-year-bond-yield' }
    ],
    desc: '通缩期与降息周期的核心锚点。'
  },
  {
    category: 'gold',
    label: '避险资产',
    icon: ShieldCheck,
    color: 'text-amber-400',
    links: [
      { name: 'KITCO 全球金价', url: 'https://www.kitco.com/charts/livegold.html' },
      { name: '金十数据-避险情报', url: 'https://www.jin10.com/' }
    ],
    desc: '通胀压力、货币信用危机与地缘政治监测。'
  },
  {
    category: 'cash',
    label: '宏观流动性',
    icon: Wallet,
    color: 'text-emerald-400',
    links: [
      { name: '财联社-宏观', url: 'https://www.cls.cn/subject/1000' },
      { name: '央行公开市场操作', url: 'http://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html' }
    ],
    desc: '关注市场现金流紧缺度与基准利率。'
  }
];

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
    const defaultDate = tomorrow.toISOString().split('T')[0];

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
        const currentPrice = h.category === 'cash' ? 1.0 : (realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : mondayPrice));
        const gapPct = h.category === 'cash' ? 0 : (mondayPrice !== 0 ? (currentPrice - mondayPrice) / mondayPrice : 0);

        initialDecisions.push({
          code: h.code, 
          name: h.name, 
          category: h.category,
          suggestedAmount: roundedAmount, 
          actualUnits: parseFloat((roundedAmount / currentPrice).toFixed(2)),
          date: defaultDate,
          timingGap: gapPct, 
          mondayNAV: mondayPrice, 
          currentNAV: currentPrice
        });
        remainingBudget = parseFloat((remainingBudget - roundedAmount).toFixed(2));
      }
    }

    if (remainingBudget > 0 && initialDecisions.length > 0) {
      const first = initialDecisions[0];
      const newAmount = parseFloat((first.suggestedAmount + remainingBudget).toFixed(2));
      first.suggestedAmount = newAmount;
      if (first.category !== 'cash') {
        first.actualUnits = parseFloat((newAmount / first.currentNAV).toFixed(2));
      } else {
        first.actualUnits = newAmount;
      }
      remainingBudget = 0;
    }
    
    setEditableDecisions(initialDecisions);
  }, [holdings.length, budget, realtimeData, userSelectedCodes]);

  const globalSignal = useMemo(() => {
    const stockGap = editableDecisions.find(d => d.category === 'stock')?.timingGap || 0;
    const goldGap = editableDecisions.find(d => d.category === 'gold')?.timingGap || 0;
    if (stockGap <= -0.015 || goldGap <= -0.015) return 'high'; 
    if (stockGap < 0 || goldGap < 0) return 'good';
    return 'warning';
  }, [editableDecisions]);

  const updateDecisionField = (index: number, field: keyof StrategyDecision, value: any) => {
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
      date: d.date,
    }));

    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    localStorage.setItem('fund_transactions', JSON.stringify(updated));
    alert(`入库成功！已生成 ${newTxs.length} 笔待确认记录。`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
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
                Budget: ¥{budget}
              </span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              根据永久投资组合 (Permanent Portfolio) 理论，算法已自动平衡资产缺口。录入前建议核对下方宏观指标。
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
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 space-y-8 backdrop-blur-xl">
            <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
              <div className="p-2 bg-amber-500/20 rounded-lg"><Zap size={16} className="text-amber-400" /></div>
              Portfolio Rebalance
            </h3>

            <div className="space-y-6">
              {(['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => {
                const currentVal = categoryValues[cat];
                const totalVal = (Object.values(categoryValues) as number[]).reduce((a, b) => a + b, 0);
                const currentPct = totalVal > 0 ? (currentVal / totalVal) * 100 : 0;
                const addedVal = editableDecisions.filter(d => d.category === cat).reduce((a,b) => a + (b.actualUnits * b.currentNAV), 0);
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
              择时提示：若股票和黄金同时出现 >1.5% 的跌幅，则进入高价值定投窗口。
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl backdrop-blur-xl">
           <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
             <h3 className="font-black text-white flex items-center gap-3 uppercase tracking-wider text-sm">
               <div className="p-2 bg-brand-500/20 rounded-lg"><ShoppingCart size={16} className="text-brand-400" /></div>
               Pending Confirmation
             </h3>
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <Clock size={12} /> BATCH MODE
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
                             <div className="flex items-center gap-2">
                               <div className="text-lg font-black text-white">{d.name}</div>
                               {holdingsByCategory[d.category].length > 1 && (
                                 <button onClick={() => handleSwapFund(d.category)} className="p-1.5 rounded-lg bg-slate-900/50 text-slate-500 hover:text-brand-400 hover:bg-slate-900 transition-all">
                                   <RefreshCw size={12} />
                                 </button>
                               )}
                             </div>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] font-mono text-slate-500">{d.code}</span>
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400">估算市值: ¥{(d.actualUnits * d.currentNAV).toFixed(2)}</span>
                             </div>
                           </div>
                        </div>

                        <div className="flex flex-1 flex-wrap md:flex-nowrap gap-4 justify-end">
                           <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-black text-slate-600 block tracking-widest">确认份额</label>
                              <input type="number" step="0.01" value={d.actualUnits} onChange={e => updateDecisionField(idx, 'actualUnits', parseFloat(e.target.value))} className="w-full sm:w-32 bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none" />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-black text-slate-600 block tracking-widest">确认日期</label>
                              <input type="date" value={d.date} onChange={e => updateDecisionField(idx, 'date', e.target.value)} className="w-full sm:w-44 bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-brand-400 outline-none" />
                           </div>
                        </div>
                     </div>
                   </div>
                 ))}
                 
                 <div className="pt-8">
                    <button onClick={handleConfirmDCA} className="w-full bg-brand-600 hover:bg-brand-500 text-white py-6 rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl transition-all">
                      <Save size={24} /> 确认记录入库
                    </button>
                 </div>
               </div>
             ) : (
               <div className="h-48 flex flex-col items-center justify-center opacity-30 italic"><p>No Decision Required</p></div>
             )}
           </div>
        </div>
      </div>

      {/* 宏观情报看板 (Macro Insight Hub) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-brand-500/20 rounded-2xl text-brand-400">
            <Globe size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">全球宏观情报看板</h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">Macroeconomic Pulse & Links</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {NEWS_SOURCES.map((source) => (
            <div key={source.category} className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl hover:border-slate-700 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl bg-slate-900/50 ${source.color}`}>
                  <source.icon size={20} />
                </div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Monitoring</div>
              </div>
              
              <h4 className="text-sm font-bold text-white mb-2">{source.label}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-6 h-8 overflow-hidden">
                {source.desc}
              </p>
              
              <div className="space-y-2">
                {source.links.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-900/50 border border-white/5 hover:bg-brand-500/10 hover:border-brand-500/30 text-[11px] font-bold text-slate-300 hover:text-brand-400 transition-all group/link"
                  >
                    {link.name}
                    <ExternalLink size={12} className="opacity-0 group-hover/link:opacity-100 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-brand-500/5 rounded-3xl border border-brand-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-4">
             <div className="p-2 bg-brand-500/20 rounded-full animate-pulse">
               <Info size={16} className="text-brand-400" />
             </div>
             <p className="text-xs text-slate-400 font-medium">
               <span className="text-brand-400 font-bold">永久组合提示：</span> 
               当债券收益率大幅上升（债价下跌）且股市低迷时，通常是由于通胀超预期。此时黄金的表现将成为组合的最后防线。
             </p>
           </div>
           <button 
             onClick={() => window.open('https://wallstreetcn.com/live/global', '_blank')}
             className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
           >
             查看全球 24H 快讯
           </button>
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
