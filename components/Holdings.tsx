import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, LineChart, PieChart as PieIcon, Wallet, ArrowUpRight, ArrowDownRight, Activity, Calendar, Coins, History, Loader2, X, Target, Info, Zap, Clock, MousePointer2, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
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

interface EnhancedTransaction extends Transaction {
  executedPrice: number;    
  executedValue: number;    
  tDayText?: string;        
  isPriceMissing?: boolean;   
}

export const Holdings: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('fund_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [navData, setNavData] = useState<Record<string, NAVPoint[]>>(() => {
    const saved = localStorage.getItem('fund_nav_cache');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [form, setForm] = useState<Partial<Transaction>>({
    code: '', name: '', type: 'buy', category: 'stock', units: 0, amount: undefined,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    localStorage.setItem('fund_transactions', JSON.stringify(transactions));
    const uniqueCodes = Array.from(new Set<string>(transactions.map(t => t.code))).filter(c => c !== 'CASH' && !navData[c]);
    uniqueCodes.forEach(code => fetchData(code));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('fund_nav_cache', JSON.stringify(navData));
  }, [navData]);

  const fetchData = async (code: string) => {
    if (loading[code]) return;
    setLoading(prev => ({ ...prev, [code]: true }));
    const data = await fetchFundData(code);
    setNavData(prev => ({ ...prev, [code]: data }));
    setLoading(prev => ({ ...prev, [code]: false }));
  };

  const handleRefreshAll = async () => {
    const codes = processedHoldings.filter(h => h.category !== 'cash').map(h => h.code);
    if (codes.length === 0) return;
    setIsSyncingAll(true);
    await Promise.all(codes.map(code => fetchData(code)));
    setIsSyncingAll(false);
  };

  const formatDateLocal = (input: number | string) => {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const processedHoldings = useMemo(() => {
    const map = new Map<string, { holding: Holding, enhancedTxs: EnhancedTransaction[] }>();
    
    transactions.forEach(t => {
      if (!map.has(t.code)) {
        const history = t.category === 'cash' ? [] : (navData[t.code] || []);
        const currentNAV = t.category === 'cash' ? 1.0 : (history.length > 0 ? history[history.length - 1].nav : 1.0);
        map.set(t.code, {
          holding: { code: t.code, name: t.name, category: t.category, totalUnits: 0, avgCost: 0, currentNAV, history, transactions: [] },
          enhancedTxs: []
        });
      }
      
      const entry = map.get(t.code)!;
      const h = entry.holding;
      let executedPrice = 0; 
      let tDayText = '待同步';
      let isPriceMissing = false;

      // 核心计算修正：
      if (t.amount !== undefined && t.amount !== null && t.units > 0) {
        executedPrice = t.amount / t.units;
        tDayText = "手动指定金额";
      } else if (h.category === 'cash') {
        executedPrice = 1.0;
        tDayText = t.date;
      } else if (h.history.length > 0) {
        const confirmDateStr = t.date;
        const confirmIndex = h.history.findIndex(p => formatDateLocal(p.timestamp) >= confirmDateStr);
        if (confirmIndex > 0) {
          const tDayPoint = h.history[confirmIndex - 1];
          executedPrice = tDayPoint.nav;
          tDayText = formatDateLocal(tDayPoint.timestamp);
        } else if (confirmIndex === 0) {
          executedPrice = h.history[0].nav;
          tDayText = formatDateLocal(h.history[0].timestamp);
        } else {
          // 如果日期超出历史范围，标记缺失，不使用 1.0
          isPriceMissing = true;
          tDayText = "历史净值缺失";
        }
      } else {
        isPriceMissing = true;
      }

      const enhanced: EnhancedTransaction = {
        ...t, executedPrice, executedValue: t.amount !== undefined ? t.amount : (t.units * executedPrice),
        tDayText, isPriceMissing
      };
      
      entry.enhancedTxs.push(enhanced);
      if (t.type === 'buy' || t.type === 'reinvest') h.totalUnits += t.units;
      else if (t.type === 'sell') h.totalUnits -= t.units;
    });

    const result: Holding[] = [];
    map.forEach(entry => {
      const h = entry.holding;
      let totalOutofPocketCost = 0; 
      let allPricesFound = true;
      
      entry.enhancedTxs.forEach(et => {
        if (et.isPriceMissing) allPricesFound = false;
        if (et.type === 'buy') {
          totalOutofPocketCost += et.executedValue;
        } else if (et.type === 'sell') {
          // 减去对应份额比例的成本
          const prevTotalUnits = h.totalUnits + et.units;
          const costToReduce = prevTotalUnits > 0 ? (et.units / prevTotalUnits) * totalOutofPocketCost : 0;
          totalOutofPocketCost = Math.max(0, totalOutofPocketCost - costToReduce);
        }
      });
      
      // 如果有买入记录但所有价格都还没同步到，不显示为 1.0
      h.avgCost = (h.totalUnits > 0 && allPricesFound) ? totalOutofPocketCost / h.totalUnits : 0;
      h.transactions = entry.enhancedTxs;
      if (h.totalUnits > 0.0001) result.push(h);
    });

    return result;
  }, [transactions, navData]);

  const stats = useMemo(() => {
    let totalMarketValue = 0, totalCostValue = 0;
    const catValue: Record<string, number> = { stock: 0, bond: 0, gold: 0, cash: 0 };
    processedHoldings.forEach(h => {
      totalMarketValue += h.totalUnits * h.currentNAV;
      totalCostValue += h.totalUnits * h.avgCost;
      catValue[h.category] += h.totalUnits * h.currentNAV;
    });
    const pieData = Object.entries(catValue).map(([name, value]) => ({ name: getCategoryName(name), value, key: name })).filter(d => d.value > 0);
    return { totalMarketValue, totalCostValue, profit: totalMarketValue - totalCostValue, pieData };
  }, [processedHoldings]);

  const handleAdd = () => {
    if (!form.code || !form.name || !form.units) return;
    const newTx: Transaction = {
      id: Date.now().toString(), code: form.code!, name: form.name!, type: form.type || 'buy', category: form.category!,
      units: Number(form.units), amount: form.amount ? Number(form.amount) : undefined, date: form.date!
    };
    setTransactions([...transactions, newTx]);
    setShowAddModal(false);
    setForm({ ...form, code: '', name: '', units: 0, amount: undefined });
  };

  const removeTx = (id: string) => setTransactions(transactions.filter(t => t.id !== id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">持仓市值</span>
          <div className="text-3xl font-bold font-mono text-white mt-1">{formatCurrency(stats.totalMarketValue, 2)}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">累计盈亏</span>
          <div className={`text-3xl font-bold font-mono mt-1 ${stats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.profit >= 0 ? '+' : ''}{formatCurrency(stats.profit, 2)}
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-brand-600 hover:bg-brand-500 text-white rounded-3xl p-6 flex items-center justify-center gap-3 font-bold text-lg active:scale-95 transition-all">
          <Plus size={32} /> 录入交易确认单
        </button>
      </div>

      <div className="bg-slate-850 rounded-3xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2 text-lg"><Coins className="text-brand-400" size={20} /> 动态持仓精算</h3>
          <button onClick={handleRefreshAll} disabled={isSyncingAll} className="bg-brand-600/10 text-brand-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-600/20 flex items-center gap-2">
            <RefreshCw size={14} className={isSyncingAll ? 'animate-spin' : ''} /> {isSyncingAll ? '同步中...' : '同步全量净值'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">资产名称</th>
                <th className="px-6 py-4">份额</th>
                <th className="px-6 py-4">单位成本</th>
                <th className="px-6 py-4 text-right">市值</th>
                <th className="px-6 py-4 text-right">盈亏</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {processedHoldings.map(h => (
                <tr key={h.code} onClick={() => setSelectedHolding(h)} className="hover:bg-slate-800/30 cursor-pointer">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[h.category] }}></div>
                      <div><div className="text-sm font-bold text-white">{h.name}</div><div className="text-[10px] font-mono text-slate-500">{h.code}</div></div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-mono text-sm">{h.totalUnits.toFixed(2)}</td>
                  <td className="px-6 py-5">
                    <div className={`text-sm font-mono font-bold ${h.avgCost > 0 ? 'text-brand-400' : 'text-slate-600 italic'}`}>
                      {h.avgCost > 0 ? h.avgCost.toFixed(h.category === 'cash' ? 2 : 4) : '数据待同步'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-bold">{formatCurrency(h.totalUnits * h.currentNAV, 2)}</td>
                  <td className={`px-6 py-5 text-right font-mono font-bold ${(h.currentNAV - h.avgCost) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.avgCost > 0 ? formatCurrency((h.currentNAV - h.avgCost) * h.totalUnits, 2) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-8 space-y-6">
            <h4 className="font-bold text-xl flex items-center gap-2"><History className="text-brand-400" /> 手动录入确认记录</h4>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="代码" className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
              <input placeholder="名称" className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <select className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.category} onChange={e => setForm({...form, category: e.target.value as FundCategory})}>
                <option value="stock">股票基金</option><option value="bond">债券固收</option><option value="gold">黄金大宗</option><option value="cash">货币现金</option>
              </select>
              <input type="date" className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              <input placeholder="份额" type="number" className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.units || ''} onChange={e => setForm({...form, units: parseFloat(e.target.value)})} />
              <input placeholder="金额 (可选)" type="number" className="bg-slate-950 border border-slate-700 p-3 rounded-xl outline-none" value={form.amount || ''} onChange={e => setForm({...form, amount: parseFloat(e.target.value)})} />
            </div>
            <button onClick={handleAdd} className="w-full bg-brand-600 py-4 rounded-2xl font-bold shadow-lg shadow-brand-500/20">确认录入</button>
          </div>
        </div>
      )}

      {selectedHolding && (
        <div className="fixed inset-0 z-[110] flex items-center justify-end">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setSelectedHolding(null)}></div>
          <div className="relative bg-slate-900 border-l border-slate-700 w-full max-w-2xl h-full p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold">{selectedHolding.name} <span className="text-sm font-mono opacity-40 ml-2">{selectedHolding.code}</span></h2>
              <button onClick={() => setSelectedHolding(null)}><X size={24} /></button>
            </div>
            <div className="space-y-4">
              {/* Fix: Cast transactions to EnhancedTransaction to access executedPrice property */}
              {(selectedHolding.transactions as EnhancedTransaction[]).sort((a,b) => b.date.localeCompare(a.date)).map(t => (
                <div key={t.id} className="bg-slate-800/40 p-5 rounded-2xl flex justify-between items-center group">
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {t.type === 'buy' ? <ArrowUpRight className="text-emerald-400" /> : <ArrowDownRight className="text-red-400" />}
                      {t.type === 'buy' ? '申购' : '赎回'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">确认日期: {t.date} · 锚定 T日价: {t.executedPrice.toFixed(4)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">{t.type === 'buy' ? '+' : '-'}{t.units.toFixed(2)} 份</div>
                    <button onClick={() => { removeTx(t.id); setSelectedHolding(null); }} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};