import React, { useState, useMemo } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Visualizer } from './components/Visualizer';
import { calculateCompoundInterest } from './utils/calculator';
import { InputState } from './types';
import { Calculator } from 'lucide-react';

const App: React.FC = () => {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col min-h-screen">
        {/* Header */}
        <header className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4 shrink-0">
          <div className="p-2 bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20">
            <Calculator className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              复利精算师 <span className="text-brand-400">Pro</span>
            </h1>
            <p className="text-slate-400 text-[10px] md:text-xs font-medium uppercase tracking-widest">
              Financial Engine
            </p>
          </div>
        </header>

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
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
      </div>
    </div>
  );
};

export default App;