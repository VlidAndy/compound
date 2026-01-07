import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Save, Trash2, PieChart as PieIcon, ListChecks, Wallet, Info } from 'lucide-react';
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

  useEffect(() => {
    localStorage.setItem('asset_items', JSON.stringify(items));
  }, [items]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

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
      // 更新逻辑
      const updatedItems = [...items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        amount: amountNum
      };
      setItems(updatedItems);
    } else {
      // 新增逻辑
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

  const handleEditClick = (item: AssetItem) => {
    setNewItem({
      name: item.name,
      amount: item.amount.toString()
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
      {/* Summary Card */}
      <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet size={80} />
        </div>
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">当前净资产总计</span>
        <div className="text-3xl md:text-4xl font-bold font-mono text-white mt-1">
          {formatCurrency(total, 2)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input List */}
        <div className="bg-slate-850 rounded-3xl border border-slate-700 p-5 md:p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ListChecks className="text-brand-400" size={20} />
              <h3 className="font-bold text-lg">资产明细录入</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md">
              <Info size={12} />
              <span>点击下方项可回填修改</span>
            </div>
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
                title={isUpdating ? "保存更新" : "添加资产"}
              >
                <Save size={20} className={isUpdating ? 'animate-pulse' : ''} />
                <span className="ml-2 text-xs font-bold sm:hidden">{isUpdating ? '更新' : '添加'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-2 min-h-[200px]">
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
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
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
                    aria-label="删除项目"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-50 py-12">
                <ListChecks size={40} />
                <p className="text-sm">暂无数据，请添加资产项</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart View */}
        <div className="bg-slate-850 rounded-3xl border border-slate-700 p-5 md:p-6 flex flex-col items-center justify-center min-h-[350px]">
          {items.length > 0 ? (
            <div className="w-full h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={115}
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
              {/* 中央视觉标识：更简约，不干扰浮窗 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <div className="bg-slate-900/80 backdrop-blur-md rounded-full p-4 border border-slate-700/50 shadow-inner">
                  <PieIcon size={20} className="text-brand-400 opacity-60" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-600 gap-4">
               <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center">
                 <PieIcon size={48} />
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
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-xl z-50 ring-1 ring-white/10">
        <p className="text-sm font-bold text-white mb-1 border-b border-slate-700 pb-1">{data.name}</p>
        <p className="text-xs text-brand-400 font-mono font-bold mt-1">{formatCurrency(data.value, 2)}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 tracking-wider uppercase">占比: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};