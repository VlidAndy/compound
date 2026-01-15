
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
    <div className="group space-y-4 p-5 rounded-[1.5rem] bg-slate-900/40 backdrop-blur-md border border-slate-700/50 hover:border-brand-500/40 transition-all duration-500 shadow-xl shadow-black/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl bg-slate-950/50 border border-slate-800/80 ${colorClass.replace('text-', 'group-hover:text-')}`}>
            <Icon size={16} className={colorClass} />
          </div>
          <span className="font-bold text-xs tracking-widest uppercase text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
        </div>
        
        {/* 精致的数字输入容器 */}
        <div className="relative flex items-center bg-slate-950/80 rounded-xl border border-slate-700/80 focus-within:border-brand-500/60 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all px-4 py-2 group-hover:bg-slate-950">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 md:w-24 bg-transparent text-right font-mono font-bold text-white outline-none text-base placeholder:text-slate-700"
          />
          <div className="ml-3 flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter group-focus-within:text-brand-400 transition-colors">
              {unit}
            </span>
          </div>
        </div>
      </div>

      <div className="relative pt-1 px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between mt-1 px-0.5">
           <span className="text-[9px] font-mono text-slate-600 font-bold uppercase tracking-tighter">MIN</span>
           <span className="text-[9px] font-mono text-slate-600 font-bold uppercase tracking-tighter">MAX</span>
        </div>
      </div>
    </div>
  );
};
