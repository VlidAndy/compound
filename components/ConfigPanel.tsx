import React from 'react';
import { InputControl } from './InputControl';
import { Wallet, PiggyBank, TrendingUp, CalendarClock, RotateCcw } from 'lucide-react';
import { InputState } from '../types';

interface ConfigPanelProps {
  values: InputState;
  onChange: (key: keyof InputState, val: number) => void;
  onReset: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ values, onChange, onReset }) => {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-1 h-6 bg-brand-500 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)]"></span>
          模型参数
        </h2>
        <button 
          onClick={onReset}
          className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="重置参数"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <InputControl
          label="初始本金"
          icon={Wallet}
          value={values.initialPrincipal}
          onChange={(v) => onChange('initialPrincipal', v)}
          min={0}
          max={1000000}
          step={1000}
          unit="¥"
        />

        <InputControl
          label="每月定投"
          icon={PiggyBank}
          value={values.monthlyContribution}
          onChange={(v) => onChange('monthlyContribution', v)}
          min={0}
          max={50000}
          step={500}
          unit="¥"
        />

        <InputControl
          label="年化收益率"
          icon={TrendingUp}
          value={values.annualRate}
          onChange={(v) => onChange('annualRate', v)}
          min={1}
          max={20}
          step={0.1}
          unit="%"
          colorClass="text-emerald-400"
        />

        <InputControl
          label="投资年限"
          icon={CalendarClock}
          value={values.years}
          onChange={(v) => onChange('years', v)}
          min={1}
          max={50}
          step={1}
          unit="年"
        />

        <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
           <p className="text-xs text-slate-400 leading-relaxed">
             <span className="text-brand-400 font-semibold">精算说明：</span> 本模型采用月复利逻辑（每月结算利息并计入下月本金）。实际结果受市场波动影响，仅供参考。
           </p>
        </div>
      </div>
    </div>
  );
};