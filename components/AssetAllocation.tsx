import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Save, Trash2, PieChart as PieIcon, ListChecks, Wallet, Info, Scale, Check, X, ArrowRight } from 'lucide-react';
import { AssetItem } from '../types';
import { formatCurrency } from '../utils/calculator';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

const DEFAULT_ITEMS: AssetItem[] = [
  { id: '1', name: '银行存款', amount: 50000.00, color: COLORS[0] },
  { id: '2', name: '指数基金', amount: 30000.55, color: COLORS[1] },
  { id: '3', name: '股票持仓', amount: 20000.12, color: COLORS[2] },
];

export const AssetAllocation: React.FC = () => {
  const [items, setItems] = useState<AssetItem[]>(() => {
    const saved = localStorage.getItem('asset_items');
    return saved ? JSON.parse(saved) : DEFAULT_ITEMS;
  });

  const [newItem, setNewItem] = useState({ name: '', amount: '' });
  const [rebalanceAmount, setRebalanceAmount] = useState<string>('');
  const [showRebalance, setShowRebalance] = useState(false);

  useEffect(() => {
    localStorage.setItem('asset_items', JSON.stringify(items));
  }, [items]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  // 流入再平衡核心逻辑
  const rebalancePreview = useMemo(() => {
    const investVal = parseFloat(rebalanceAmount);
    if (isNaN(investVal) || investVal <= 0 || items.length === 0) return null;

    let activeItems = [...items];
    let currentInvestment = investVal;
    let allocations: Record<string, number> = {};

    // 迭代排除“过载”资产（即已有金额已经超过平衡目标的资产）
    while (activeItems.length > 0) {
      const activeSum = activeItems.reduce((s, i) => s + i.amount, 0);
      const targetPerAsset = (activeSum + currentInvestment) / activeItems.length;
      
      const tooRich = activeItems.filter(item => item.amount > targetPerAsset);
      
      if (tooRich.length > 0) {
        // 排除掉这些资产，它们不参与分配
        tooRich.forEach(tr => {
          allocations[tr.id] = 0;
        });
        activeItems = activeItems.filter(item => item.amount <= targetPerAsset);
      } else {
        // 所有剩余资产均可分配
        activeItems.forEach(item => {
          allocations[item.id] = parseFloat((targetPerAsset - item.amount).toFixed(2));
        });
        break;
      }
    }

    return items.map(item => ({
      ...item,
      added: allocations[item.id] || 0,
      final: item.amount + (allocations[item.id] || 0)
    }));
  }, [items, rebalanceAmount]);

  const chartData = useMemo(() => 
    items.map(item => ({
      name: item.name,
      value: parseFloat(item.amount.toFixed(2)),
      color: item.color,
      percentage: total > 0 ? ((item.amount / total) * 100).toFixed(2) : "0.00"
    })).sort((a, b) => b.value - a.value),
  [items, total]);

  const handleSaveItem = () => {
    if (!newItem.name || newItem.amount === '') return;
    
    const amountNum = parseFloat(newItem.amount);
    const existingIndex = items.findIndex(i => i.name.trim().toLowerCase() === newItem.name.trim().toLowerCase());

    if (existingIndex !== -1) {
      const updatedItems = [...items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        amount: amountNum
      };
      setItems(updatedItems);
    } else {
      const item: AssetItem = {
        id: Date.now().toString(),
        name: newItem.name.trim(),
        amount: amountNum,
        color: COLORS[items.length % COLORS.length]
      };
      setItems([...items, item]);
    }
    
    setNewItem({ name: '', amount: '' });
  };

  const handleApplyRebalance = () => {
    if (rebalancePreview) {
      const updatedItems = rebalancePreview.map(({ added, final, ...item }) => ({
        ...item,
        amount: parseFloat(final.toFixed(2))
      }));
      setItems(updatedItems);
      setRebalanceAmount('');
      setShowRebalance(false);
    }
  };

  const handleEditClick = (item: AssetItem) => {
    setNewItem({
      name: item.name,
      amount: item.amount.toFixed(2)
    });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const isUpdating = useMemo(() => 
    items.some(i => i.name.trim().toLowerCase() === newItem.name.trim().toLowerCase()),
  [newItem.name, items]);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-slate-900/50 border border-slate-700 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">当前净资产总计</span>
          <div className="text-3xl md:text-4xl font-bold font-mono text-white mt-1">
            {formatCurrency(total, 2)}
          </div>
        </div>
        
        {/* Rebalance Toggle Card */}
        <button 
          onClick={() => setShowRebalance(!showRebalance)}
          className={`p-6 rounded-3xl border transition-all flex flex-col justify-center items-center gap-2 group relative overflow-hidden ${
            showRebalance ? 'bg-brand-600 border-brand-400 text-white shadow-lg shadow-brand-500/20' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-brand-500/50 hover:text-white'
          }`}
        >
          <Scale size={32} className={showRebalance ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'} />
          <span className="font-bold text-sm tracking-wide">流入再平衡</span>
          {showRebalance && <div className="absolute top-2 right-2"><X size={16} /></div>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input & Rebalance Column */}
        <div className="flex flex-col space-y-6">
          {/* Main Input Form */}
          <div className="bg-slate-850 rounded-3xl border border-slate-700 p-5 md:p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ListChecks className="text-brand-400" size={20} />
                <h3 className="font-bold text-lg">资产明细录入</h3>
              </div>
              {!showRebalance && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">
                  <Info size={12} />
                  <span>点击项回填修改</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input 
                type="text" 
                placeholder="资产名称" 
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 sm:py-2 text-sm outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600"
              />
              <div className="flex gap-2 w-full sm:w-auto">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01"
                  value={newItem.amount}
                  onChange={e => setNewItem({...newItem, amount: e.target.value})}
                  className="flex-1 sm:w-32 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 sm:py-2 text-sm font-mono outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600"
                />
                <button 
                  onClick={handleSaveItem}
                  className={`${isUpdating ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-brand-600 shadow-brand-500/20'} hover:brightness-110 px-4 py-3 sm:py-2 rounded-xl transition-all shadow-lg flex items-center justify-center min-w-[60px] group`}
                >
                  <Save size={20} className={isUpdating ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-2 min-h-[250px] max-h-[400px]">
              {items.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleEditClick(item)}
                  className={`flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border transition-all cursor-pointer group active:scale-[0.98] ${
                    newItem.name.trim().toLowerCase() === item.name.toLowerCase() 
                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5' 
                    : 'border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium text-slate-200">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs sm:text-sm text-slate-300">{formatCurrency(item.amount, 2)}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="text-slate-500 hover:text-red-400 p-2 sm:p-1 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-50 py-12">
                  <ListChecks size={40} />
                  <p className="text-sm">暂无数据</p>
                </div>
              )}
            </div>
          </div>

          {/* Rebalance Panel (Overlay or Section) */}
          {showRebalance && (
            <div className="bg-slate-900 border-2 border-brand-500/30 rounded-3xl p-5 md:p-6 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="text-brand-400" size={24} />
                <h3 className="font-bold text-xl text-white">定投资产再平衡</h3>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400 font-bold">¥</span>
                  <input 
                    type="number"
                    placeholder="输入定投总额..."
                    value={rebalanceAmount}
                    onChange={e => setRebalanceAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-8 pr-4 py-4 text-xl font-mono text-white outline-none focus:border-brand-500 transition-all shadow-inner"
                  />
                </div>

                {rebalancePreview && (
                  <div className="space-y-2 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">分配预览 (最终均等原则)</p>
                    {rebalancePreview.map(prev => (
                      <div key={prev.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div className="text-sm">
                          <div className="font-medium text-slate-300">{prev.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {formatCurrency(prev.amount, 2)} <ArrowRight size={10} className="inline mx-1" /> {formatCurrency(prev.final, 2)}
                          </div>
                        </div>
                        <div className={`text-sm font-mono font-bold ${prev.added > 0 ? 'text-emerald-400' : 'text-slate-500 opacity-50'}`}>
                          +{formatCurrency(prev.added, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => { setShowRebalance(false); setRebalanceAmount(''); }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={18} /> 取消
                  </button>
                  <button 
                    onClick={handleApplyRebalance}
                    disabled={!rebalancePreview}
                    className="flex-[2] bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:hover:bg-brand-600 text-white py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                  >
                    <Check size={18} /> 确定并更新资产
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart View */}
        <div className="bg-slate-850 rounded-3xl border border-slate-700 p-5 md:p-6 flex flex-col items-center justify-center min-h-[400px]">
          {items.length > 0 ? (
            <div className="w-full h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="#1e293b" 
                        strokeWidth={2}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
                            
              {/* 中央视觉标识：彻底减弱，只保留最虚化的轮廓，完全不遮挡视野 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
                <div className="w-20 h-20 rounded-full border border-slate-700/30 flex items-center justify-center">
                   <PieIcon size={16} className="text-brand-500/10" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-600 gap-4">
               <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center">
                 <PieIcon size={32} />
               </div>
               <p className="text-sm font-medium">数据不足以生成图表</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/98 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-2xl z-[100] ring-1 ring-white/10 min-w-[140px]">
        <p className="text-sm font-bold text-white mb-1 border-b border-slate-700/50 pb-1">{data.name}</p>
        <p className="text-xs text-brand-400 font-mono font-bold mt-1.5">{formatCurrency(data.value, 2)}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">份额占比</span>
          <span className="text-[10px] text-slate-400 font-mono font-semibold">{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
};