import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, LineChart, PieChart as PieIcon, Wallet, ArrowUpRight, ArrowDownRight, Activity, Calendar, Coins, History, Loader2, X, Target, Info, Zap, Clock, MousePointer2, BarChart3, TrendingUp } from 'lucide-react';
import { Transaction, Holding, FundCategory, TransactionType, NAVPoint } from '../types';
import { formatCurrency } from '../utils/calculator';
import { fetchFundData, getCategoryName } from '../utils/fundApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceDot, BarChart, Bar } from 'recharts';

const CATEGORY_COLORS: Record<FundCategory, string> = {
  stock: '#ef4444',
  bond: '#0ea5e9',
  gold: '#f59e0b',
  cash: '#10b981'
};

// 扩展交易接口，用于存储计算出的成交详情
interface EnhancedTransaction extends Transaction {
  executedPrice: number;    // T日实际成交价
  executedValue: number;    // T日成交金额
  tDayText?: string;        // T日日期文本
  isPriceStale?: boolean;   // 标记是否因为找不到T日而使用了回退值
}

export const Holdings: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fund_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
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

  // 当 navData 更新时，同步到缓存
  useEffect(() => {
    localStorage.setItem('fund_nav_cache', JSON.stringify(navData));
  }, [navData]);

  const fetchData = async (code: string) => {
    setLoading(prev => ({ ...prev, [code]: true }));
    const data = await fetchFundData(code);
    setNavData(prev => ({ ...prev, [code]: data }));
    setLoading(prev => ({ ...prev, [code]: false }));
  };

  /**
   * 使用本地时间格式化日期。
   */
  const formatDateLocal = (input: number | string) => {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 核心计算引擎
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
      
      let executedPrice = 1.0; 
      let tDayText = h.category === 'cash' ? t.date : '计算中...';
      let isPriceStale = true;
      const confirmDateStr = t.date;
      
      if (h.category === 'cash') {
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
      }

      const enhanced: EnhancedTransaction = {
        ...t,
        executedPrice,
        executedValue: t.units * executedPrice,
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
      
      entry.enhancedTxs.forEach(et => {
        if (et.type === 'buy') {
          totalOutofPocketCost += et.executedValue;
        } else if (et.type === 'sell') {
          const costToReduce = h.totalUnits > 0 ? (et.units / h.totalUnits) * totalOutofPocketCost : 0;
          totalOutofPocketCost = Math.max(0, totalOutofPocketCost - costToReduce);
        }
      });
      
      h.avgCost = h.totalUnits > 0 ? totalOutofPocketCost / h.totalUnits : 1.0;
      h.transactions = entry.enhancedTxs;
      
      if (h.totalUnits > 0.0001) {
        result.push(h);
      }
    });

    return result;
  }, [transactions, navData]);

  const filteredHistory = useMemo(() => {
    if (!selectedHolding || !selectedHolding.history || selectedHolding.history.length === 0) return [];
    const earliestTxTs = Math.min(...selectedHolding.transactions.map(t => new Date(t.date).getTime()));
    const padding = 7 * 24 * 60 * 60 * 1000;
    return selectedHolding.history.filter(p => p.timestamp >= (earliestTxTs - padding));
  }, [selectedHolding]);

  const cashScaleHistory = useMemo(() => {
    if (!selectedHolding || selectedHolding.category !== 'cash') return [];
    
    const sortedTxs = [...selectedHolding.transactions].sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    
    const dailyData: Record<string, number> = {};
    sortedTxs.forEach(t => {
      if (t.type === 'buy' || t.type === 'reinvest') runningTotal += t.units;
      else if (t.type === 'sell') runningTotal -= t.units;
      dailyData[t.date] = runningTotal;
    });

    return Object.entries(dailyData).map(([date, balance]) => ({
      date,
      balance: parseFloat(balance.toFixed(2))
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedHolding]);

  const stats = useMemo(() => {
    let totalMarketValue = 0;
    let totalCostValue = 0;
    const catValue: Record<string, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };
    
    processedHoldings.forEach(h => {
      const val = h.totalUnits * h.currentNAV;
      const cost = h.totalUnits * h.avgCost;
      totalMarketValue += val;
      totalCostValue += cost;
      catValue[h.category] += val;
    });

    const pieData = Object.entries(catValue).map(([name, value]) => ({
      name: getCategoryName(name),
      value,
      key: name
    })).filter(d => d.value > 0);

    return { totalMarketValue, totalCostValue, profit: totalMarketValue - totalCostValue, pieData };
  }, [processedHoldings]);

  const handleAdd = () => {
    if (!form.code || !form.name || !form.units) return;
    const newTx: Transaction = {
      id: Date.now().toString(),
      code: form.code!,
      name: form.name!,
      type: form.type!,
      category: form.category!,
      units: Number(form.units),
      date: form.date!
    };
    setTransactions([...transactions, newTx]);
    setShowAddModal(false);
    setForm({ ...form, code: '', name: '', units: 0 });
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-slate-850 rounded-3xl border border-slate-700 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Coins className="text-brand-400" size={20} /> 动态持仓精算视图
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">基于单位净值(Net Worth)</span>
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
                {processedHoldings.map(h => {
                  const profit = (h.currentNAV - h.avgCost) * h.totalUnits;
                  return (
                    <tr 
                      key={h.code} 
                      onClick={() => setSelectedHolding(h)}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer group active:bg-slate-800/60"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ backgroundColor: CATEGORY_COLORS[h.category] }}></div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">{h.name}</div>
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
                        {formatCurrency(h.totalUnits * h.currentNAV, 2)}
                      </td>
                      <td className={`px-6 py-5 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{formatCurrency(profit, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-850 rounded-3xl border border-slate-700 p-6 flex flex-col items-center">
          <h3 className="font-bold text-lg mb-6 self-start flex items-center gap-2">
            <PieIcon className="text-brand-400" size={20} /> 市值分配比例
          </h3>
          {stats.pieData.length > 0 ? (
            <div className="w-full h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry) => (
                      <Cell key={`cell-${entry.key}`} fill={CATEGORY_COLORS[entry.key as FundCategory]} stroke="none" />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">分类占比</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 italic">暂无资产数据</div>
          )}
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
                  <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">确认日期 (T+1)</label>
                  <input type="date" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-brand-500 font-mono text-white" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
              </div>

              <div className="p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl flex items-start gap-3">
                <Zap size={18} className="text-brand-400 mt-0.5 shrink-0" />
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="text-slate-200 font-bold">净值采集算法 (Net Worth)：</span> 
                  系统将采集“单位净值”而非“累计净值”。分红再投将摊薄您的单位持仓成本，真实反映资产增值与现金投入的比例。
                </div>
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
                <div className="p-4 rounded-2xl bg-brand-600 shadow-xl shadow-brand-500/10 text-white">
                  <Coins size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedHolding.name}</h2>
                  <div className="text-xs font-mono text-slate-400 mt-1">{selectedHolding.code} · {getCategoryName(selectedHolding.category)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedHolding(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-8 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '总持仓份额', value: selectedHolding.totalUnits.toFixed(2), unit: '份' },
                  { label: '摊薄平均价', value: selectedHolding.avgCost.toFixed(selectedHolding.category === 'cash' ? 2 : 4), highlight: true, highlightColor: 'text-brand-400' },
                  { label: '最新单位净值', value: selectedHolding.currentNAV.toFixed(selectedHolding.category === 'cash' ? 2 : 4) },
                  { label: '账面总盈亏', value: formatCurrency((selectedHolding.currentNAV - selectedHolding.avgCost) * selectedHolding.totalUnits, 2), highlight: true },
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
                  <Calendar size={18} className="text-brand-400" /> 单位净值穿透记录 (T日成交)
                </h5>
                <div className="space-y-3">
                  {selectedHolding.transactions.sort((a,b) => b.date.localeCompare(a.date)).map((t: any) => (
                    <div key={t.id} className="bg-slate-800/20 border border-slate-700 p-5 rounded-2xl flex items-center justify-between group border-l-4 border-l-brand-500 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${t.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : t.type === 'sell' ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>
                          {t.type === 'buy' ? <ArrowUpRight size={20} /> : t.type === 'sell' ? <ArrowDownRight size={20} /> : <TrendingUp size={20} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">
                            {t.type === 'buy' ? '买入' : t.type === 'sell' ? '赎回' : '分红增持'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 italic">确认日: {t.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-white">
                          {t.type === 'sell' ? '-' : '+'}{t.units.toFixed(2)} <span className="text-[10px] opacity-40">份</span>
                        </div>
                        <div className={`flex items-center justify-end gap-1.5 text-[10px] mt-1.5 font-bold ${t.type === 'reinvest' ? 'text-brand-400' : 'text-slate-500'}`}>
                          <Target size={12} /> {t.type === 'reinvest' ? '分红基准' : '成交价(T日)'}: {t.executedPrice.toFixed(selectedHolding.category === 'cash' ? 2 : 4)}
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
                    {selectedHolding.category === 'cash' ? '存量变化趋势' : '单位净值波动与成交锚点'}
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
                          return <ReferenceDot key={t.id} x={pt.timestamp} y={pt.nav} r={5} fill="#10b981" stroke="#fff" strokeWidth={2} />;
                        })}
                      </ReLineChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-slate-600 text-center mt-4 italic font-medium">
                  {selectedHolding.category === 'cash' 
                    ? "展示历史资金流入后的存量阶梯" 
                    : "绿色锚点锁定 T日 单位净值。分红记录仅增加份额，不增加现金本金。"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};