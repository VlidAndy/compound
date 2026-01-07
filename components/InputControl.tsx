import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputControlProps {
  label: string;
  icon: LucideIcon;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  colorClass?: string;
}

export const InputControl: React.FC<InputControlProps> = ({
  label,
  icon: Icon,
  value,
  onChange,
  min,
  max,
  step,
  unit = '',
  colorClass = 'text-brand-400'
}) => {
  return (
    <div className="group space-y-3 p-4 rounded-2xl bg-slate-800/50 hover:bg-slate-800 transition-all duration-300 border border-slate-700/50 hover:border-brand-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300 group-hover:text-white transition-colors">
          <Icon size={18} className={colorClass} />
          <span className="font-medium text-sm tracking-wide uppercase opacity-80">{label}</span>
        </div>
        <div className="flex items-center bg-slate-900/80 rounded-lg px-3 py-1 border border-slate-700 focus-within:border-brand-500 transition-colors">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 bg-transparent text-right font-mono text-white outline-none"
          />
          <span className="ml-2 text-slate-500 text-sm font-mono">{unit}</span>
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
};