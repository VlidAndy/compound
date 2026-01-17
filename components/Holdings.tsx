
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, LineChart, PieChart as PieIcon, Wallet, ArrowUpRight, ArrowDownRight, Activity, Calendar, Coins, History, Loader2, X, Target, Info, Zap, Clock, MousePointer2, BarChart3, TrendingUp, RefreshCw, Eye, EyeOff, Archive, ArrowRightLeft, Sparkles, TrendingDown } from 'lucide-react';
import { Transaction, Holding, FundCategory, TransactionType, NAVPoint } from '../types';
import { formatCurrency } from '../utils/calculator';
import { fetchFundData, getCategoryName, findMondayBaseline } from '../utils/fundApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot, BarChart, Bar, Cell as BarCell } from 'recharts';

const CATEGORY_COLORS: Record<FundCategory, string> = {
  stock: '#ef4444',
  bond: '#0ea5e9',
  gold: '#f59e0b',
  cash: '#10b981'
};

interface EnhancedTransaction extends Transaction {
  executedPrice: number;    
  executedValue: number;    
  tDayText?: string;        
  isPriceStale?: boolean;   
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 border border-white/20 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl z-[1000] ring-1 ring-white/10 min-w-[160px] transform-gpu transition-all animate-in zoom-in-95">
        <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[data.key as FundCategory] }}></div>
          <p className="text-sm font-black text-white">{data.name}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">当前估值</span>
            <span className="text-sm font-mono font-black text-brand-400">{formatCurrency(data.value, 2)}</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">资产权重</span>
            <span className="text-xs font-mono font-bold text-slate-200">{data.percentage}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const Holdings: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fund_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [navData, setNavData] = useState<Record<string, NAVPoint[]>>(() => {
    const saved = localStorage.getItem('fund_nav_cache');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [form, setForm] = useState<Partial<Transaction>>({
    code: '',
    name: '',
    type: 'buy',
    category: 'stock',
    units: 0,
    amount: undefined,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    localStorage.setItem('fund_transactions', JSON.stringify(transactions));
    const uniqueCodes = Array.from(new Set<string>(transactions.map(t => t.code))).filter(c => c !== 'CASH' && !navData[c]);
    uniqueCodes.forEach(code => {
      if (!loading[code]) {
        fetchData(code);
      }
    });
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('fund_nav_cache', JSON.stringify(navData));
  }, [navData]);

  const fetchData = async (code: string) => {
    setLoading(prev => ({ ...prev, [code]: true }));
    const data = await fetchFundData(code);
    setNavData(prev => ({ ...prev, [code]: data }));
    setLoading(prev => ({ ...prev, [code]: false }));
  };

  const handleRefreshAll = async () => {
    const codes = processedHoldings
      .filter(h => h.category !== 'cash')
      .map(h => h.code);
    
    if (codes.length === 0) return;

    setIsSyncingAll(true);
    await Promise.all(codes.map(code => fetchData(code)));
    setIsSyncingAll(false);
  };

  const formatDateLocal = (input: number | string) => {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const processedHoldings = useMemo(() => {
    const map = new Map<string, { holding: Holding, enhancedTxs: EnhancedTransaction[] }>();
    
    transactions.forEach(t => {
      if (!map.has(t.code)) {
        const history = t.category === 'cash' ? [] : (navData[t.code] || []);
        const currentNAV = t.category === 'cash' ? 1.0 : (history.length > 0 ? history[history.length - 1].nav : 1.0);

        map.set(t.code, {
          holding: {
            code: t.code,
            name: t.name,
            category: t.category,
            totalUnits: 0,
            avgCost: 0,
            currentNAV,
            history,
            transactions: []
          },
          enhancedTxs: []
        });
      }
      
      const entry = map.get(t.code)!;
      const h = entry.holding;
      
      let executedPrice = 0; 
      let tDayText = h.category === 'cash' ? t.date : '估算中...';
      let isPriceStale = true;
      const confirmDateStr = t.date;
      
      if (t.amount !== undefined && t.amount !== null && t.units > 0) {
        executedPrice = t.amount / t.units;
        isPriceStale = false;
        tDayText = "记录固定金额";
      } else if (h.category === 'cash') {
        executedPrice = 1.0;
        isPriceStale = false;
        tDayText = t.date;
      } else if (h.history.length > 0) {
        const confirmIndex = h.history.findIndex(p => formatDateLocal(p.timestamp) >= confirmDateStr);
        if (confirmIndex > 0) {
          const tDayPoint = h.history[confirmIndex - 1];
          executedPrice = tDayPoint.nav;
          tDayText = formatDateLocal(tDayPoint.timestamp);
          isPriceStale = false;
        } else if (confirmIndex === 0) {
          executedPrice = h.history[0].nav;
          tDayText = formatDateLocal(h.history[0].timestamp);
          isPriceStale = false;
        } else {
          const latest = h.history[h.history.length - 1];
          executedPrice = latest.nav;
          tDayText = `暂取最新(${formatDateLocal(latest.timestamp)})`;
          isPriceStale = true;
        }
      } else {
        executedPrice = h.currentNAV || 1.0;
      }

      const enhanced: EnhancedTransaction = {
        ...t,
        executedPrice,
        executedValue: t.amount !== undefined ? t.amount : (t.units * executedPrice),
        tDayText,
        isPriceStale
      };
      
      entry.enhancedTxs.push(enhanced);

      if (t.type === 'buy' || t.type === 'reinvest') {
        h.totalUnits += t.units;
      } else if (t.type === 'sell') {
        h.totalUnits -= t.units;
      }
    });

    const result: Holding[] = [];
    map.forEach(entry => {
      const h = entry.holding;
      let totalOutofPocketCost = 0; 
      const sortedEnhanced = [...entry.enhancedTxs].sort((a,b) => a.date.localeCompare(b.date));
      let currentUnitsForCalc = 0;
      sortedEnhanced.forEach(et => {
        if (et.type === 'buy') {
          totalOutofPocketCost += et.executedValue;
          currentUnitsForCalc += et.units;
        } else if (et.type === 'sell') {
          const costToReduce = currentUnitsForCalc > 0 ? (et.units / currentUnitsForCalc) * totalOutofPocketCost : 0;
          totalOutofPocketCost = Math.max(0, totalOutofPocketCost - costToReduce);
          currentUnitsForCalc -= et.units;
        }
      });
      h.avgCost = currentUnitsForCalc > 0.0001 ? totalOutofPocketCost / currentUnitsForCalc : 0;
      h.transactions = sortedEnhanced;
      result.push(h);
    });

    return result.sort((a, b) => {
      if (a.totalUnits > 0.0001 && b.totalUnits <= 0.0001) return -1;
      if (a.totalUnits <= 0.0001 && b.totalUnits > 0.0001) return 1;
      return b.totalUnits * b.currentNAV - a.totalUnits * a.currentNAV;
    });
  }, [transactions, navData]);

  // 新增：本周结余精算统计
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now.setDate(now.getDate() - diffToMonday));
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toISOString().split('T')[0];

    let totalWeeklyProfit = 0;
    const catGains: Record<FundCategory, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };

    processedHoldings.forEach(h => {
      if (h.category === 'cash') {
        // 货币类仅计算本周分红
        const weeklyDividends = h.transactions
          .filter(t => t.type === 'reinvest' && t.date >= mondayStr)
          .reduce((sum, t) => sum + (t.amount || t.units), 0);
        catGains.cash += weeklyDividends;
        totalWeeklyProfit += weeklyDividends;
      } else {
        // 非货币类计算周内市值波动
        if (h.totalUnits <= 0.0001) return;
        const baseline = findMondayBaseline(h.history);
        const mondayPrice = baseline?.nav || (h.history.length > 0 ? h.history[0].nav : h.currentNAV);
        const gain = h.totalUnits * (h.currentNAV - mondayPrice);
        catGains[h.category] += gain;
        totalWeeklyProfit += gain;
      }
    });

    const contributionData = (['stock', 'bond', 'gold', 'cash'] as FundCategory[]).map(cat => ({
      name: getCategoryName(cat),
      value: parseFloat(catGains[cat].toFixed(2)),
      key: cat
    })).sort((a, b) => b.value - a.value);

    return { totalWeeklyProfit, catGains, contributionData, mondayStr };
  }, [processedHoldings]);

  const stats = useMemo(() => {
    let totalMarketValue = 0;
    let totalCostValue = 0;
    const catValue: Record<string, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };
    
    processedHoldings.forEach(h => {
      if (h.totalUnits > 0.0001) {
        const val = h.totalUnits * h.currentNAV;
        const cost = h.totalUnits * h.avgCost;
        totalMarketValue += val;
        totalCostValue += cost;
        catValue[h.category] += val;
      }
    });

    const pieData = Object.entries(catValue).map(([name, value]) => ({
      name: getCategoryName(name),
      value,
      key: name,
      percentage: totalMarketValue > 0 ? ((value / totalMarketValue) * 100).toFixed(2) : "0.00"
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

    return { totalMarketValue, totalCostValue, profit: totalMarketValue - totalCostValue, pieData };
  }, [processedHoldings]);

  const handleAdd = () => {
    if (!form.code || !form.name || !form.units) return;
    const newTx: Transaction = {
      id: Date.now().toString(),
      code: form.code!,
      name: form.name!,
      type: form.type || 'buy',
      category: form.category!,
      units: Number(form.units),
      amount: form.amount ? Number(form.amount) : undefined,
      date: form.date!
    };
    setTransactions([...transactions, newTx]);
    setShowAddModal(false);
    setForm({ ...form, code: '', name: '', units: 0, amount: undefined });
  };

  const removeTx = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const fillExistingAsset = (h: Holding) => {
    setForm({
      ...form,
      code: h.code,
      name: h.name,
      category: h.category
    });
  };

  const visibleHoldings = showClosed 
    ? processedHoldings 
    : processedHoldings.filter(h => h.totalUnits > 0.0001);

  // 精算：计算选中资产的特定历史视图数据
  const { cashScaleHistory, filteredHistory } = useMemo(() => {
    if (!selectedHolding) return { cashScaleHistory: [], filteredHistory: [] };

    if (selectedHolding.category === 'cash') {
      // 对货币类资产，通过交易流水还原余额变动曲线
      const sortedTxs = [...selectedHolding.transactions].sort((a, b) => a.date.localeCompare(b.date));
      let currentBalance = 0;
      const history = sortedTxs.map(t => {
        // 货币类资产 units 通常等于金额，优先取 amount
        const change = (t.amount !== undefined && t.amount !== null) ? t.amount : t.units;
        if (t.type === 'buy' || t.type === 'reinvest') {
          currentBalance += change;
        } else if (t.type === 'sell') {
          currentBalance -= change;
        }
        return {
          date: t.date,
          balance: parseFloat(currentBalance.toFixed(2))
        };
      });
      return { cashScaleHistory: history, filteredHistory: [] };
    } else {
      // 对非货币类，直接使用外部抓取的净值历史
      return { 
        cashScaleHistory: [], 
        filteredHistory: selectedHolding.history 
      };
    }
  }, [selectedHolding]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet size={80} /></div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest text-glow">持仓估值总额</span>
          <div className="text-3xl font-bold font-mono text-white mt-1">{formatCurrency(stats.totalMarketValue, 2)}</div>
          <div className="text-xs text-slate-500 mt-2">累计现金本金: {formatCurrency(stats.totalCostValue, 2)}</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Activity size={80} /></div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest text-glow">历史累计盈亏</span>
          <div className={`text-3xl font-bold font-mono mt-1 ${stats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.profit >= 0 ? '+' : ''}{formatCurrency(stats.profit, 2)}
          </div>
          <div className="text-xs text-slate-500 mt-2">含分红总收益率: {stats.totalCostValue > 0 ? ((stats.profit / stats.totalCostValue) * 100).toFixed(2) : '0'}%</div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all shadow-lg shadow-brand-500/20 active:scale-95 group"
        >
          <div className="bg-white/20 p-3 rounded-full group-hover:rotate-90 transition-transform">
            <Plus size={32} />
          </div>
          <span className="font-bold text-lg">录入资产变动记录</span>
        </button>
      </div>

      {/* 本周结余精算看板 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 items-center justify-between relative z-10">
           <div className="space-y-4 max-w-sm">
             <div className="flex items-center gap-2">
               <Sparkles className="text-amber-400" size={16} />
               <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Weekly Performance Hub</span>
             </div>
             <h2 className="text-2xl font-black text-white">本周结余详情</h2>
             <div className="space-y-1">
               <div className={`text-4xl font-mono font-black ${weeklyStats.totalWeeklyProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                 {weeklyStats.totalWeeklyProfit >= 0 ? '+' : ''}{formatCurrency(weeklyStats.totalWeeklyProfit, 2)}
               </div>
               <p className="text-xs text-slate-500 font-medium">统计周期：自本周一 {weeklyStats.mondayStr} 至今</p>
             </div>
             <div className="pt-4 flex items-center gap-4">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                   <span>浮盈贡献</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                   <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                   <span>资产回撤</span>
                </div>
             </div>
           </div>

           <div className="flex-1 w-full lg:max-w-xl h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyStats.contributionData} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} opacity={0.2} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                  <ChartTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-white/20 p-3 rounded-xl shadow-2xl">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">{data.name} 本周贡献</p>
                            <p className={`text-lg font-mono font-black ${data.value >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {data.value >= 0 ? '+' : ''}{formatCurrency(data.value, 2)}
                            </p>
                            {data.key === 'cash' && <p className="text-[8px] text-amber-500 mt-1 uppercase">* 仅计入分红记录</p>}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {weeklyStats.contributionData.map((entry, index) => (
                      <BarCell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-slate-850 rounded-3xl border border-slate-700 overflow-hidden flex flex-col shadow-xl">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
              <Coins className="text-brand-400" size={20} /> 动态持仓精算视图
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowClosed(!showClosed)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  showClosed 
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' 
                    : 'bg-slate-800 text-slate-400 border border-transparent hover:border-slate-600'
                }`}
                title={showClosed ? "隐藏已结清资产" : "显示历史结清资产"}
              >
                {showClosed ? <Eye size={14} /> : <EyeOff size={14} />}
                {showClosed ? '显示结清' : '显示结清'}
              </button>
              <button 
                onClick={handleRefreshAll}
                disabled={isSyncingAll || processedHoldings.length === 0}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSyncingAll 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-brand-600/10 text-brand-400 hover:bg-brand-600/20'
                }`}
              >
                <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} />
                {isSyncingAll ? '同步中...' : '全量同步'}
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-850/95 backdrop-blur text-[10px] uppercase text-slate-500 border-b border-slate-700 z-10">
                <tr>
                  <th className="px-6 py-4">资产名称</th>
                  <th className="px-6 py-4">持有份额</th>
                  <th className="px-6 py-4">单位成交价</th>
                  <th className="px-6 py-4 text-right">实时市值</th>
                  <th className="px-6 py-4 text-right">账面盈亏</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {visibleHoldings.map(h => {
                  const isClosed = h.totalUnits <= 0.0001;
                  const profit = isClosed ? 0 : (h.currentNAV - h.avgCost) * h.totalUnits;
                  const isItemLoading = loading[h.code];
                  return (
                    <tr 
                      key={h.code} 
                      onClick={() => setSelectedHolding(h)}
                      className={`hover:bg-slate-800/30 transition-colors cursor-pointer group active:bg-slate-800/60 ${isClosed ? 'opacity-40 grayscale-[0.6]' : ''}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ backgroundColor: CATEGORY_COLORS[h.category] }}></div>
                          <div className="relative">
                            <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors flex items-center gap-2">
                              {h.name}
                              {isClosed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase font-black">Closed</span>}
                              {isItemLoading && <Loader2 size={12} className="animate-spin text-brand-500" />}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">{h.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-mono text-sm text-slate-300">{h.totalUnits.toFixed(2)}</td>
                      <td className="px-6 py-5 font-mono text-sm">
                        <div className="text-brand-400 font-bold">{h.avgCost.toFixed(h.category === 'cash' ? 2 : 4)}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> 摊薄后的单位成本
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono font-bold text-white">
                        {isClosed ? '---' : formatCurrency(h.totalUnits * h.currentNAV, 2)}
                      </td>
                      <td className={`px-6 py-5 text-right font-mono font-bold ${isClosed ? 'text-slate-600' : profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isClosed ? '已结清' : `${profit >= 0 ? '+' : ''}${formatCurrency(profit, 2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 市值分配比例面板 */}
        <div className="lg:col-span-4 bg-slate-850/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 flex flex-col shadow-2xl relative">
          <div className="flex items-center gap-2 mb-6 shrink-0">
            <div className="p-2 bg-brand-500/20 rounded-lg">
              <PieIcon className="text-brand-400" size={20} />
            </div>
            <h3 className="font-bold text-lg text-white">市值分配比例</h3>
          </div>
          
          <div className="flex-1 flex flex-col relative">
            {stats.pieData.length > 0 ? (
              <>
                <div className="w-full h-56 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1000}
                      >
                        {stats.pieData.map((entry) => (
                          <Cell 
                            key={`cell-${entry.key}`} 
                            fill={CATEGORY_COLORS[entry.key as FundCategory]} 
                            stroke="#0f172a" 
                            strokeWidth={2}
                            className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                          />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        content={<CustomPieTooltip />} 
                        wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                        allowEscapeViewBox={{ x: true, y: true }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
                    <div className="w-16 h-16 rounded-full border border-slate-700/30 flex items-center justify-center">
                       <PieIcon size={14} className="text-brand-500/10" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 overflow-auto custom-scrollbar flex-1 pr-1">
                  {stats.pieData.map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-700/30 group hover:border-brand-500/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.key as FundCategory] }}></div>
                        <div>
                          <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.percentage}% 份额</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-slate-300">{formatCurrency(item.value, 2)}</p>
                        <p className="text-[9px] text-slate-600 uppercase tracking-tighter mt-0.5">EST. VALUE</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic gap-4 opacity-50">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center">
                  <PieIcon size={24} />
                </div>
                <p className="text-sm font-medium">暂无资产分布数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-850">
              <h4 className="font-bold text-xl flex items-center gap-2 text-white">
                <History className="text-brand-400" size={24} /> 交易确认录入
              </h4>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              
              {processedHoldings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <MousePointer2 size={12} className="text-brand-400" />
                    <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">快速选择存量资产</label>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                    {processedHoldings.map(h => (
                      <button 
                        key={h.code} 
                        onClick={() => fillExistingAsset(h)}
                        className={`px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-all flex items-center gap-2 active:scale-95 ${form.code === h.code ? 'border-brand-500 bg-brand-500/10 text-brand-400' : ''}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[h.category] }}></div>
                        {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">资产代码</label>
                  <input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 font-mono text-white" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="如: 000001 / CASH" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">资产名称</label>
                  <input className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="基金或资产简称" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">资产类型</label>
                  <select className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 appearance-none text-white" value={form.category} onChange={e => setForm({...form, category: e.target.value as FundCategory})}>
                    <option value="stock">股票 / 偏股基金</option>
                    <option value="bond">债券 / 固收</option>
                    <option value="gold">黄金 / 大宗商品</option>
                    <option value="cash">货币资产 / 现金</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">交易动作</label>
                  <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-700">
                    {['buy', 'sell', 'reinvest'].map(type => (
                      <button key={type} onClick={() => setForm({...form, type: type as TransactionType})} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${form.type === type ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                        {type === 'buy' ? '申购' : type === 'sell' ? '赎回' : '分红'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">成交份额</label>
                  <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 font-mono text-white" value={form.units || ''} onChange={e => setForm({...form, units: parseFloat(e.target.value)})} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">成交金额 (可选)</label>
                  <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 font-mono text-white" value={form.amount || ''} onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} placeholder="留空则按净值估算" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">确认日期 (T+1)</label>
                <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 font-mono text-white" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>

              <button onClick={handleAdd} className="w-full bg-brand-600 hover:bg-brand-500 py-4 rounded-2xl font-bold text-white shadow-lg shadow-brand-500/20 transition-all active:scale-[0.98] mt-4">
                确认录入记录
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedHolding && (
        <div className="fixed inset-0 z-[110] flex items-center justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedHolding(null)}></div>
          <div className="relative bg-slate-900 border-l border-slate-700 w-full max-w-2xl h-full shadow-2xl animate-in slide-in-from-right overflow-y-auto custom-scrollbar flex flex-col">
            <div className="p-8 bg-slate-850 border-b border-slate-700 flex justify-between items-start sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl shadow-xl shadow-brand-500/10 text-white ${selectedHolding.totalUnits <= 0.0001 ? 'bg-slate-700' : 'bg-brand-600'}`}>
                  <Coins size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    {selectedHolding.name}
                    {selectedHolding.totalUnits <= 0.0001 && <span className="text-xs px-2 py-1 bg-slate-800 text-slate-500 rounded-lg border border-slate-700 uppercase font-black tracking-tighter">Liquidated</span>}
                  </h2>
                  <div className="text-xs font-mono text-slate-400 mt-1">{selectedHolding.code} · {getCategoryName(selectedHolding.category)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedHolding(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-8 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '持有总份额', value: selectedHolding.totalUnits.toFixed(2), unit: '份' },
                  { label: '摊薄平均价', value: selectedHolding.totalUnits > 0.0001 ? selectedHolding.avgCost.toFixed(selectedHolding.category === 'cash' ? 2 : 4) : '---', highlight: selectedHolding.totalUnits > 0.0001, highlightColor: 'text-brand-400' },
                  { label: '最新单位净值', value: selectedHolding.currentNAV.toFixed(selectedHolding.category === 'cash' ? 2 : 4) },
                  { label: '持仓账面盈亏', value: selectedHolding.totalUnits > 0.0001 ? formatCurrency((selectedHolding.currentNAV - selectedHolding.avgCost) * selectedHolding.totalUnits, 2) : '已结清', highlight: selectedHolding.totalUnits > 0.0001 },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                    <div className={`text-sm md:text-base font-bold font-mono ${item.highlight ? (item.highlightColor || (selectedHolding.currentNAV >= selectedHolding.avgCost ? 'text-emerald-400' : 'text-red-400')) : 'text-slate-200'}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h5 className="font-bold flex items-center gap-2 text-slate-300 border-b border-slate-800 pb-2">
                  <Calendar size={18} className="text-brand-400" /> 历史成交脉络 (流水明细)
                </h5>
                <div className="space-y-3">
                  {selectedHolding.transactions.sort((a,b) => b.date.localeCompare(a.date)).map((t: any) => (
                    <div key={t.id} className={`bg-slate-800/20 border border-slate-700 p-5 rounded-2xl flex items-center justify-between group shadow-sm transition-all border-l-4 ${t.type === 'buy' ? 'border-l-emerald-500' : t.type === 'sell' ? 'border-l-red-500' : 'border-l-brand-500'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${t.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : t.type === 'sell' ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>
                          {t.type === 'buy' ? <ArrowUpRight size={20} /> : t.type === 'sell' ? <ArrowDownRight size={20} /> : <TrendingUp size={20} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">
                            {t.type === 'buy' ? '申购确认' : t.type === 'sell' ? '赎回确认' : '分红/再投资'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 italic">确认日期: {t.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-white">
                          {t.type === 'sell' ? '-' : '+'}{t.units.toFixed(2)} <span className="text-[10px] opacity-40">份</span>
                        </div>
                        <div className={`flex items-center justify-end gap-1.5 text-[10px] mt-1.5 font-bold ${t.type === 'reinvest' ? 'text-brand-400' : 'text-slate-500'}`}>
                          <Target size={12} /> {t.type === 'reinvest' ? '分红估算' : '确认价(T日)'}: {t.executedPrice.toFixed(selectedHolding.category === 'cash' ? 2 : 4)}
                        </div>
                      </div>
                      <button onClick={() => { removeTx(t.id); setSelectedHolding(null); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-400 transition-all rounded-lg ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-850 rounded-3xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h5 className="font-bold flex items-center gap-2 text-slate-300">
                    {selectedHolding.category === 'cash' ? <BarChart3 size={18} className="text-brand-400" /> : <LineChart size={18} className="text-brand-400" />}
                    {selectedHolding.category === 'cash' ? '流动性存量趋势' : '净值轨迹与成交分布'}
                  </h5>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedHolding.category === 'cash' ? (
                      <BarChart data={cashScaleHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis hide domain={[0, 'auto']} />
                        <ChartTooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        />
                        <Bar dataKey="balance" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    ) : (
                      <ReLineChart data={filteredHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }} labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                        <Line type="monotone" dataKey="nav" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                        {selectedHolding.transactions.map(t => {
                          const confirmDateStr = t.date;
                          const idx = selectedHolding.history.findIndex(p => formatDateLocal(p.timestamp) >= confirmDateStr);
                          const pt = idx > 0 ? selectedHolding.history[idx - 1] : (idx === 0 ? selectedHolding.history[0] : null);
                          if (!pt) return null;
                          return <ReferenceDot key={t.id} x={pt.timestamp} y={pt.nav} r={5} fill={t.type === 'buy' ? '#10b981' : t.type === 'sell' ? '#ef4444' : '#38bdf8'} stroke="#fff" strokeWidth={2} />;
                        })}
                      </ReLineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
