import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { Plus, Trash2, PieChart as PieIcon, ListChecks, Wallet } from 'lucide-react';
import { AssetItem } from '../types';
import { formatCurrency } from '../utils/calculator';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

export const AssetAllocation: React.FC = () => {
  const [items, setItems] = useState<AssetItem[]>([
    { id: '1', name: '银行存款', amount: 50000, color: COLORS[0] },
    { id: '2', name: '指数基金', amount: 30000, color: COLORS[1] },
    { id: '3', name: '股票持仓', amount: 20000, color: COLORS[2] },
  ]);

  const [newItem, setNewItem] = useState({ name: '', amount: '' });

  const total = useMemo(() => items.reduce((sum, item) => sum + item.amount, 0), [items]);

  const chartData = useMemo(() => 
    items.map(item => ({
      name: item.name,
      value: item.amount,
      color: item.color,
      percentage: ((item.amount / total) * 100).toFixed(1)
    })).sort((a, b) => b.value - a.value),
  [items, total]);

  const addItem = () => {
    if (!newItem.name || !newItem.amount) return;
    const item: AssetItem = {
      id: Date.now().toString(),
      name: newItem.name,
      amount: parseFloat(newItem.amount),
      color: COLORS[items.length % COLORS.length]
    };
    setItems([...items, item]);
    setNewItem({ name: '', amount: '' });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Card */}
      <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet size={80} />
        </div>
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">当前净资产总计</span>
        <div className="text-3xl md:text-4xl font-bold font-mono text-white mt-1">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input List */}
        <div className="bg-slate-850 rounded-3xl border border-slate-700 p-5 md:p-6 flex flex-col space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="text-brand-400" size={20} />
            <h3 className="font-bold text-lg">资产明细录入</h3>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="资产名称" 
              value={newItem.name}
              onChange={e => setNewItem({...newItem, name: e.target.value})}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-500 transition-colors"
            />
            <input 
              type="number" 
              placeholder="金额" 
              value={newItem.amount}
              onChange={e => setNewItem({...newItem, amount: e.target.value})}
              className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm font-mono outline-none focus:border-brand-500 transition-colors"
            />
            <button 
              onClick={addItem}
              className="bg-brand-600 hover:bg-brand-500 p-2 rounded-xl transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 group">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-medium text-slate-200">{item.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-slate-300">{formatCurrency(item.amount)}</span>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
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
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Central Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">分布</span>
                <span className="text-xl font-bold text-white"><PieIcon size={24} className="text-brand-400" /></span>
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
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-sm font-bold text-white mb-1">{data.name}</p>
        <p className="text-xs text-brand-400 font-mono">{formatCurrency(data.value)}</p>
        <p className="text-[10px] text-slate-500 mt-1">占比: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};