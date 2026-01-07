import React, { useState, useMemo } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Visualizer } from './components/Visualizer';
import { AssetAllocation } from './components/AssetAllocation';
import { calculateCompoundInterest } from './utils/calculator';
import { InputState, AppTool } from './types';
import { Calculator, ChevronDown, TrendingUp, PieChart as PieIcon, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<AppTool>('calculator');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [inputs, setInputs] = useState<InputState>({
    initialPrincipal: 10000,
    monthlyContribution: 2000,
    annualRate: 8.0,
    years: 20
  });

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

  const toolLabels: Record<AppTool, string> = {
    calculator: '复利精算引擎',
    allocation: '资产配置看板'
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col min-h-screen">
        {/* Header with Switcher */}
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20">
              {activeTool === 'calculator' ? <Calculator size={24} /> : <PieIcon size={24} />}
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 group"
              >
                <div>
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    复利精算师 <span className="text-brand-400">Pro</span>
                    <ChevronDown size={18} className={`text-slate-500 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                  </h1>
                  <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-widest text-left">
                    {toolLabels[activeTool]}
                  </p>
                </div>
              </button>

              {/* Tool Menu Dropdown */}
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-4 w-64 bg-slate-900/95 border border-slate-700 backdrop-blur-xl rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                    <button 
                      onClick={() => { setActiveTool('calculator'); setIsMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${activeTool === 'calculator' ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-slate-800 text-slate-300'}`}
                    >
                      <TrendingUp size={18} />
                      <div className="text-left">
                        <div className="text-sm font-bold">复利预测引擎</div>
                        <div className="text-[10px] opacity-60">未来财富增长演练</div>
                      </div>
                    </button>
                    <button 
                      onClick={() => { setActiveTool('allocation'); setIsMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors mt-1 ${activeTool === 'allocation' ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-slate-800 text-slate-300'}`}
                    >
                      <PieIcon size={18} />
                      <div className="text-left">
                        <div className="text-sm font-bold">资产占比看板</div>
                        <div className="text-[10px] opacity-60">实时资产分布分析</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-full border border-slate-700">
             <LayoutDashboard size={14} className="text-slate-500" />
             <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Laboratory v1.2</span>
          </div>
        </header>

        {/* Main Content Render */}
        <main className="flex-1 pb-6">
          {activeTool === 'calculator' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Left Panel: Config */}
              <div className="lg:col-span-4 bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col h-fit lg:sticky lg:top-8">
                <ConfigPanel 
                  values={inputs} 
                  onChange={handleInputChange} 
                  onReset={handleReset}
                />
              </div>

              {/* Right Panel: Visualization */}
              <div className="lg:col-span-8 flex flex-col min-h-[500px]">
                <Visualizer data={calculationResult} />
              </div>
            </div>
          ) : (
            <AssetAllocation />
          )}
        </main>

        {/* Footer info */}
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