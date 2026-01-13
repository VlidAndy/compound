import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Coins, ArrowRight, Wallet, Info, Zap, ChevronRight, Activity, ShoppingCart, Timer } from 'lucide-react';
import { Transaction, Holding, FundCategory, NAVPoint } from '../types';
import { fetchRealtimeValuation, findMondayBaseline, getCategoryName } from '../utils/fundApi';
import { formatCurrency } from '../utils/calculator';

interface StrategyDecision {
  code: string;
  name: string;
  category: FundCategory;
  amount: number;
  timingGap: number; // 当前对比周一基准的跌幅
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

  // 从持仓中恢复 navData
  useEffect(() => {
    const saved = localStorage.getItem('fund_nav_cache');
    if (saved) setNavData(JSON.parse(saved));
  }, []);

  // 加载交易数据时的衍生持仓
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

  // 类别市值统计
  const categoryValues = useMemo(() => {
    const vals: Record<FundCategory, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };
    holdings.forEach(h => {
      const currentPrice = realtimeData[h.code] || (h.history.length > 0 ? h.history[h.history.length-1].nav : 1.0);
      vals[h.category] += h.totalUnits * currentPrice;
    });
    return vals;
  }, [holdings, realtimeData]);

  // 获取实时数据
  const syncMarket = async () => {
    setIsSyncing(true);
    const codes = Array.from(new Set(holdings.map(h => h.code))).filter(c => c !== 'CASH');
    const results: Record<string, number> = {};
    for (const code of codes) {
      const val = await fetchRealtimeValuation(code);
      if (val) results[code] = val;
    }
    setRealtimeData(results);
    setIsSyncing(false);
  };

  useEffect(() => {
    if (holdings.length > 0) syncMarket();
  }, [holdings.length]);

  // 核心决策逻辑：再平衡分配
  const decisions = useMemo(() => {
    if (holdings.length === 0) return [];

    // 1. 每类资产选出一只“定投首选”（这里取当前类别中持仓最多的那只）
    const preferredPerCategory: Partial<Record<FundCategory, Holding>> = {};
    holdings.forEach(h => {
      const current = preferredPerCategory[h.category];
      if (!current || h.totalUnits > current.totalUnits) {
        preferredPerCategory[h.category] = h;
      }
    });

    // 2. 补差法分配 budget
    const totalValue = Object.values(categoryValues).reduce((a, b) => a + b, 0);
    const targetValue = (totalValue + budget) / 4; // 25/25/25/25 目标
    
    let remainingBudget = budget;
    const allocation: StrategyDecision[] = [];

    // 计算各类别缺口并排序（饥渴优先）
    const gaps = (['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => ({
      cat,
      gap: Math.max(0, targetValue - categoryValues[cat])
    })).sort((a, b) => b.gap - a.gap);

    // 分配
    for (const g of gaps) {
      if (remainingBudget <= 0) break;
      const h = preferredPerCategory[g.cat];
      if (!h) continue;

      const give = Math.min(remainingBudget, g.gap);
      if (give > 0) {
        const baseline = findMondayBaseline(h.history);
        const mondayPrice = baseline?.nav || 1.0;
        const currentPrice = realtimeData[h.code] || mondayPrice;
        const gapPct = (currentPrice - mondayPrice) / mondayPrice;

        allocation.push({
          code: h.code,
          name: h.name,
          category: h.category,
          amount: Math.round(give),
          timingGap: gapPct,
          mondayNAV: mondayPrice,
          currentNAV: currentPrice
        });
        remainingBudget -= give;
      }
    }

    // 如果还有剩余 budget (所有都溢出了)，平均分配给非现金资产
    if (remainingBudget > 0) {
      const topPick = preferredPerCategory['stock'] || preferredPerCategory['gold'] || holdings[0];
      const existing = allocation.find(a => a.code === topPick.code);
      if (existing) {
        existing.amount += remainingBudget;
      } else {
        const baseline = findMondayBaseline(topPick.history);
        const mP = baseline?.nav || 1.0;
        allocation.push({
          code: topPick.code,
          name: topPick.name,
          category: topPick.category,
          amount: remainingBudget,
          mondayNAV: mP,
          currentNAV: realtimeData[topPick.code] || mP,
          timingGap: ( (realtimeData[topPick.code] || mP) - mP) / mP
        });
      }
    }

    return allocation;
  }, [holdings, categoryValues, budget, realtimeData]);

  // 择时评分与高亮逻辑
  const globalSignal = useMemo(() => {
    const stockGap = decisions.find(d => d.category === 'stock')?.timingGap || 0;
    const goldGap = decisions.find(d => d.category === 'gold')?.timingGap || 0;
    
    if (stockGap < -0.015 || goldGap < -0.015) return 'high'; // 强烈推荐 300
    if (stockGap < 0 || goldGap < 0) return 'good'; // 建议买入
    return 'warning'; // 成本高企
  }, [decisions]);

  const handleConfirmDCA = () => {
    const newTxs: Transaction[] = decisions.map(d => ({
      id: `dca-${Date.now()}-${d.code}`,
      code: d.code,
      name: d.name,
      type: 'buy',
      category: d.category,
      units: d.amount / d.currentNAV,
      date: new Date().toISOString().split('T')[0],
      timingAlpha: (d.mondayNAV - d.currentNAV) * (d.amount / d.currentNAV) // 节省了多少钱
    }));

    const updated = [...transactions, ...newTxs];
    setTransactions(updated);
    localStorage.setItem('fund_transactions', JSON.stringify(updated));
    alert(`成功记录 ${decisions.length} 笔定投！本周择时共为你节省约 ${formatCurrency(newTxs.reduce((a,b) => a + (b.timingAlpha || 0), 0), 2)}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
      {/* 顶部：择时红绿灯卡片 */}
      <div className={`p-8 rounded-[2rem] relative overflow-hidden transition-all duration-500 border-2 ${
        globalSignal === 'high' ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]' :
        globalSignal === 'good' ? 'bg-blue-950/40 border-brand-500 shadow-[0_0_30px_rgba(14,165,233,0.15)]' :
        'bg-orange-950/30 border-orange-500/50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Timer className={globalSignal === 'high' ? 'text-emerald-400' : 'text-brand-400'} size={20} />
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">本周择时行情评估</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white flex items-baseline gap-3">
              {globalSignal === 'high' ? '极佳加码窗口' : globalSignal === 'good' ? '周四择时获胜' : '成本高于周一'}
              <span className={`text-sm px-3 py-1 rounded-full border ${globalSignal === 'high' ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                {budget}元方案
              </span>
            </h2>
            <p className="text-slate-400 text-sm max-w-md">
              {globalSignal === 'high' ? '检测到大类资产出现 >1.5% 回调。此时买入可显著摊薄成本，建议启用 300 元上限。' : 
               globalSignal === 'good' ? '当前估值低于周一收盘价，择时正收益。系统已自动按 25% 比例进行饥渴补差分配。' : 
               '目前主要资产价格处于本周高位。如需保持纪律，建议仅执行 200 元保底金额。'}
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-4">
             <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700">
               {[200, 300].map(val => (
                 <button
                   key={val}
                   onClick={() => setBudget(val as 200 | 300)}
                   className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${budget === val ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   ¥{val}
                 </button>
               ))}
             </div>
             <button 
                onClick={syncMarket} 
                disabled={isSyncing}
                className="text-[10px] uppercase font-bold text-slate-500 hover:text-brand-400 flex items-center gap-1.5 transition-colors"
             >
               <Activity size={12} className={isSyncing ? 'animate-spin' : ''} />
               {isSyncing ? '正在同步估值...' : '同步实时行情'}
             </button>
          </div>
        </div>
        
        {/* 背景虚化装饰 */}
        <div className={`absolute -right-20 -bottom-20 w-64 h-64 blur-3xl rounded-full opacity-20 ${
           globalSignal === 'high' ? 'bg-emerald-500' : 'bg-brand-500'
        }`}></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 中部：再平衡看板 */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-700 rounded-3xl p-6 flex flex-col space-y-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Zap size={18} className="text-amber-400" /> 缺口补平分析
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Target: 25.0%</span>
          </div>

          <div className="space-y-5">
            {(['stock', 'gold', 'bond', 'cash'] as FundCategory[]).map(cat => {
              const currentVal = categoryValues[cat];
              const totalVal = Object.values(categoryValues).reduce((a, b) => a + b, 0);
              const currentPct = totalVal > 0 ? (currentVal / totalVal) * 100 : 0;
              
              const addedVal = decisions.filter(d => d.category === cat).reduce((a,b) => a + b.amount, 0);
              const targetPct = totalVal > 0 ? ((currentVal + addedVal) / (totalVal + budget)) * 100 : 25;

              return (
                <div key={cat} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400">{getCategoryName(cat)}</span>
                    <span className="text-white font-mono">{currentPct.toFixed(1)}% <ArrowRight size={10} className="inline mx-1 opacity-40" /> {targetPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full transition-all duration-1000" 
                      style={{ 
                        width: `${currentPct}%`, 
                        backgroundColor: CATEGORY_COLORS[cat] 
                      }} 
                    />
                    <div 
                      className="h-full bg-white/20 animate-pulse transition-all duration-1000" 
                      style={{ 
                        width: `${targetPct - currentPct}%` 
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="pt-4 border-t border-slate-800/50">
            <div className="bg-slate-950/40 p-4 rounded-2xl flex items-start gap-3">
              <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                算法原则：优先满足比例缺口最大的资产，单次定投每类资产仅限一只。周四实时估值与周一收盘对比，负 Gap 越大，加码动力越足。
              </p>
            </div>
          </div>
        </div>

        {/* 底部：执行清单 */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-700 rounded-3xl overflow-hidden flex flex-col shadow-xl backdrop-blur-md">
           <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-850/30">
             <h3 className="font-bold flex items-center gap-2">
               <ShoppingCart size={18} className="text-brand-400" /> 本周执行指令清单
             </h3>
             <span className="text-[10px] font-mono text-slate-500 uppercase">Automated Strategy v1.0</span>
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar">
             {decisions.length > 0 ? (
               <div className="p-6 space-y-4">
                 {decisions.map(d => (
                   <div key={d.code} className="group bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 p-5 rounded-2xl flex items-center justify-between transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[d.category] }}></div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">{d.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-slate-500">{d.code}</span>
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${d.timingGap < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {d.timingGap < 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                              对比周一: {(d.timingGap * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">建议买入金额</div>
                        <div className="text-xl font-mono font-bold text-white">¥{d.amount}</div>
                     </div>
                   </div>
                 ))}
                 
                 <div className="pt-6">
                    <button 
                      onClick={handleConfirmDCA}
                      className="w-full bg-brand-600 hover:bg-brand-500 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-brand-500/30 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle2 size={24} /> 确认并记录本周操作
                    </button>
                    <p className="text-center text-[10px] text-slate-600 mt-4 uppercase tracking-widest font-bold">
                      操作提示：完成银行/券商 App 交易后点击确认，择时 Alpha 将计入总账
                    </p>
                 </div>
               </div>
             ) : (
               <div className="h-64 flex flex-col items-center justify-center text-slate-600 italic">
                 <Coins size={40} className="mb-4 opacity-20" />
                 暂无决策指令，请先在持仓页面录入数据。
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
  bond: '#0ea5e9',
  gold: '#f59e0b',
  cash: '#10b981'
};
