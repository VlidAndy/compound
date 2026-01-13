import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Visualizer } from './components/Visualizer';
import { AssetAllocation } from './components/AssetAllocation';
import { Holdings } from './components/Holdings';
import { StrategyEngine } from './components/StrategyEngine';
import { calculateCompoundInterest } from './utils/calculator';
import { InputState, AppTool } from './types';
import { Calculator, ChevronDown, TrendingUp, PieChart as PieIcon, LayoutDashboard, Briefcase, Zap, Download, Upload, FileJson } from 'lucide-react';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<AppTool>(() => {
    const saved = localStorage.getItem('active_tool');
    return (saved as AppTool) || 'calculator';
  });
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputs, setInputs] = useState<InputState>(() => {
    const saved = localStorage.getItem('fund_app_inputs');
    return saved ? JSON.parse(saved) : {
      initialPrincipal: 10000,
      monthlyContribution: 2000,
      annualRate: 8.0,
      years: 20
    };
  });

  useEffect(() => {
    localStorage.setItem('active_tool', activeTool);
  }, [activeTool]);

  useEffect(() => {
    localStorage.setItem('fund_app_inputs', JSON.stringify(inputs));
  }, [inputs]);

  const calculationResult = useMemo(() => {
    return calculateCompoundInterest(
      inputs.initialPrincipal,
      inputs.monthlyContribution,
      inputs.annualRate,
      inputs.years
    );
  }, [inputs]);

  const handleInputChange = (key: keyof InputState, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setInputs({
      initialPrincipal: 10000,
      monthlyContribution: 2000,
      annualRate: 8.0,
      years: 20
    });
  };

  // 数据导出逻辑
  const handleExportData = () => {
    const keys = ['fund_transactions', 'fund_nav_cache', 'asset_items', 'fund_app_inputs', 'active_tool'];
    const backup: Record<string, any> = {};
    
    keys.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          backup[key] = JSON.parse(val);
        } catch {
          backup[key] = val;
        }
      }
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    
    link.href = url;
    link.download = `${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 数据导入逻辑
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (typeof data !== 'object') throw new Error('Invalid format');

        // 覆盖保存到 localStorage
        Object.entries(data).forEach(([key, value]) => {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(key, stringValue);
        });

        alert('数据恢复成功！应用即将刷新。');
        window.location.reload();
      } catch (err) {
        alert('导入失败：文件格式不正确。');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const toolLabels: Record<AppTool, string> = {
    calculator: '复利精算引擎',
    allocation: '资产配置看板',
    holdings: '我的持仓与历史',
    strategy: '定投决策引擎'
  };

  const ToolIcon = ({ tool, size }: { tool: AppTool, size: number }) => {
    switch (tool) {
      case 'calculator': return <Calculator size={size} />;
      case 'allocation': return <PieIcon size={size} />;
      case 'holdings': return <Briefcase size={size} />;
      case 'strategy': return <Zap size={size} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col min-h-screen">
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20">
              <ToolIcon tool={activeTool} size={24} />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 group"
              >
                <div className="text-left">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    资产管家 <span className="text-brand-400">Pro</span>
                    <ChevronDown size={18} className={`text-slate-500 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                  </h1>
                  <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-widest">
                    {toolLabels[activeTool]}
                  </p>
                </div>
              </button>

              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-4 w-72 bg-slate-900/95 border border-slate-700 backdrop-blur-xl rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                    {[
                      { id: 'strategy', title: '定投决策引擎', sub: '择时与再平衡算法', icon: <Zap size={18} className="text-amber-400" /> },
                      { id: 'holdings', title: '我的持仓管理', sub: '历史交易与净值穿透', icon: <Briefcase size={18} className="text-brand-400" /> },
                      { id: 'calculator', title: '复利精算引擎', sub: '未来财富增长演练', icon: <TrendingUp size={18} /> },
                      { id: 'allocation', title: '资产配置看板', sub: '实时资产分布分析', icon: <PieIcon size={18} /> },
                    ].map((tool) => (
                      <button 
                        key={tool.id}
                        onClick={() => { setActiveTool(tool.id as AppTool); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors mt-1 ${activeTool === tool.id ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-slate-800 text-slate-300'}`}
                      >
                        {tool.icon}
                        <div className="text-left">
                          <div className="text-sm font-bold">{tool.title}</div>
                          <div className="text-[10px] opacity-60">{tool.sub}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {/* 备份与恢复按钮组 */}
            <div className="flex items-center bg-slate-900/50 rounded-full border border-slate-700 p-1">
              <button 
                onClick={handleExportData}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-tighter"
              >
                <Download size={12} className="text-brand-400" /> 备份
              </button>
              <div className="w-[1px] h-3 bg-slate-700 mx-0.5"></div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-tighter"
              >
                <Upload size={12} className="text-emerald-400" /> 恢复
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportData} 
                accept=".json" 
                className="hidden" 
              />
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-full border border-slate-700">
               <LayoutDashboard size={14} className="text-slate-500" />
               <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Laboratory v1.8</span>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-6">
          {activeTool === 'calculator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="lg:col-span-4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col h-fit lg:sticky lg:top-8">
                <ConfigPanel values={inputs} onChange={handleInputChange} onReset={handleReset} />
              </div>
              <div className="lg:col-span-8 flex flex-col min-h-[500px]">
                <Visualizer data={calculationResult} />
              </div>
            </div>
          )}
          {activeTool === 'allocation' && <AssetAllocation />}
          {activeTool === 'holdings' && <Holdings />}
          {activeTool === 'strategy' && <StrategyEngine />}
        </main>

        <footer className="mt-auto pt-4 border-t border-slate-900 text-center">
          <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
            Wealth Visualization Engine &copy; 2025 Professional Edition
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;