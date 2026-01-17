
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { Visualizer } from './components/Visualizer';
import { AssetAllocation } from './components/AssetAllocation';
import { Holdings } from './components/Holdings';
import { StrategyEngine } from './components/StrategyEngine';
import { GlobalNews } from './components/GlobalNews';
import { Toast, ConfirmDialog, NotificationType } from './components/Notification';
import { calculateCompoundInterest } from './utils/calculator';
import { InputState, AppTool } from './types';
import { 
  Calculator, 
  ChevronDown, 
  TrendingUp, 
  PieChart as PieIcon, 
  Briefcase, 
  Zap, 
  Download, 
  Upload, 
  CloudUpload, 
  CloudDownload, 
  RefreshCw,
  Loader2,
  Trash2,
  X,
  Calendar,
  Database,
  Newspaper
} from 'lucide-react';

const CLOUD_API_BASE = 'https://fancy-resonance-a403.664014238qq.workers.dev';
const CLOUD_TOKEN = 'aptx4869';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<AppTool>(() => {
    const saved = localStorage.getItem('active_tool');
    return (saved as AppTool) || 'calculator';
  });
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [showBackupList, setShowBackupList] = useState(false);
  const [backups, setBackups] = useState<string[]>([]);
  const [selectedBackupDate, setSelectedBackupDate] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>('');
  
  // Notification States
  const [toast, setToast] = useState<{ msg: string; type: NotificationType } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; onConfirm: () => void } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: NotificationType = 'success') => setToast({ msg, type });

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

  const getAppBackupData = () => {
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
    return backup;
  };

  const applyImportedData = (data: any, successMsg: string = '数据恢复成功！正在刷新。') => {
    if (!data || typeof data !== 'object') {
      showToast('无效的数据格式', 'error');
      return;
    }

    try {
      Object.entries(data).forEach(([key, value]) => {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringValue);
      });
      showToast(successMsg, 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showToast('存储写入失败', 'error');
    }
  };

  const fetchBackupList = async () => {
    setIsCloudLoading(true);
    try {
      const response = await fetch(`${CLOUD_API_BASE}/backup/list`, {
        headers: { 'Authorization': `Bearer ${CLOUD_TOKEN}` }
      });
      const result = await response.json();
      if (result.success) {
        setBackups(result.backups || []);
      } else {
        showToast(result.error || '获取列表失败', 'error');
      }
    } catch (error) {
      showToast('网络连接失败', 'error');
    } finally {
      setIsCloudLoading(false);
    }
  };

  // 核心变更：带冲突检测的备份逻辑
  const performCloudBackup = async () => {
    setIsCloudLoading(true);
    try {
      const backupData = getAppBackupData();
      const response = await fetch(`${CLOUD_API_BASE}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CLOUD_TOKEN}`
        },
        body: JSON.stringify(backupData)
      });

      const result = await response.json();
      if (result.success) {
        showToast(`备份成功！${result.date}`);
        fetchBackupList();
      } else {
        showToast('备份失败: ' + result.error, 'error');
      }
    } catch (error) {
      showToast('上传失败', 'error');
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleCloudBackupRequest = () => {
    const today = new Date().toISOString().split('T')[0];
    const hasToday = backups.some(d => d.startsWith(today));

    if (hasToday) {
      setConfirm({
        title: '覆盖备份确认',
        msg: `今日 (${today}) 已存在云端备份，继续操作将覆盖现有存档。确认继续吗？`,
        onConfirm: () => {
          setConfirm(null);
          performCloudBackup();
        }
      });
    } else {
      performCloudBackup();
    }
  };

  const handleRestoreBackup = async (date: string) => {
    if (!date) return;
    setConfirm({
      title: '同步确认',
      msg: `确定要恢复 ${date} 的快照吗？当前本地未保存的数据将被覆盖！`,
      onConfirm: async () => {
        setConfirm(null);
        setIsCloudLoading(true);
        try {
          const response = await fetch(`${CLOUD_API_BASE}/backup?date=${date}`, {
            headers: { 'Authorization': `Bearer ${CLOUD_TOKEN}` }
          });
          const result = await response.json();
          if (result.success && result.data) {
            let actualData = result.data;
            if (typeof actualData === 'string') {
              try { actualData = JSON.parse(actualData); } catch {}
            }
            applyImportedData(actualData, `云同步成功！正在加载 ${date} 的全量快照...`);
          } else {
            showToast('数据获取失败', 'error');
          }
        } catch (error) {
          showToast('同步请求失败', 'error');
        } finally {
          setIsCloudLoading(false);
        }
      }
    });
  };

  const handleDeleteBackup = async (date: string) => {
    setConfirm({
      title: '永久删除确认',
      msg: `确定要永久删除 ${date} 的云端备份吗？此操作无法撤销。`,
      onConfirm: async () => {
        setConfirm(null);
        setIsCloudLoading(true);
        try {
          const response = await fetch(`${CLOUD_API_BASE}/backup?date=${date}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${CLOUD_TOKEN}` }
          });
          const result = await response.json();
          if (result.success) {
            setBackups(prev => prev.filter(d => d !== date));
            if (selectedBackupDate === date) setSelectedBackupDate(null);
            showToast('备份已安全移除');
          } else {
            showToast('删除失败', 'error');
          }
        } catch (error) {
          showToast('网络连接失败', 'error');
        } finally {
          setIsCloudLoading(false);
        }
      }
    });
  };

  const filteredBackups = useMemo(() => {
    if (!monthFilter) return backups;
    return backups.filter(date => date.startsWith(monthFilter));
  }, [backups, monthFilter]);

  const toolLabels: Record<AppTool, string> = {
    calculator: '复利精算引擎',
    allocation: '资产配置看板',
    holdings: '我的持仓与历史',
    strategy: '定投决策引擎',
    news: '全球宏观情报库'
  };

  const ToolIcon = ({ tool, size }: { tool: AppTool, size: number }) => {
    switch (tool) {
      case 'calculator': return <Calculator size={size} />;
      case 'allocation': return <PieIcon size={size} />;
      case 'holdings': return <Briefcase size={size} />;
      case 'strategy': return <Zap size={size} />;
      case 'news': return <Newspaper size={size} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30 overflow-x-hidden">
      {/* Notifications */}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog 
          title={confirm.title} 
          message={confirm.msg} 
          onConfirm={confirm.onConfirm} 
          onCancel={() => setConfirm(null)} 
        />
      )}

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col min-h-screen">
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-110">
              <ToolIcon tool={activeTool} size={24} />
            </div>
            
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 group">
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
                      { id: 'news', title: '全球宏观情报', sub: '深度资讯与研报追踪', icon: <Newspaper size={18} className="text-emerald-400" /> },
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
            <div className="flex items-center bg-slate-900/50 rounded-full border border-slate-700 p-1 shadow-lg shadow-black/20">
              <button 
                onClick={() => { setShowBackupList(true); fetchBackupList(); }}
                disabled={isCloudLoading}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-50"
              >
                {isCloudLoading ? <Loader2 size={14} className="animate-spin text-brand-400" /> : <Database size={14} className="text-brand-400" />} 
                备份与云同步
              </button>
            </div>

            <div className="flex items-center bg-slate-900/50 rounded-full border border-slate-700 p-1 shadow-lg shadow-black/20">
              <button onClick={() => {
                const backup = getAppBackupData();
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `local_backup_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-tighter">
                <Download size={12} className="text-slate-500" /> 导出
              </button>
              <div className="w-[1px] h-3 bg-slate-700 mx-0.5"></div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all uppercase tracking-tighter">
                <Upload size={12} className="text-slate-500" /> 导入
              </button>
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                   try {
                     applyImportedData(JSON.parse(event.target?.result as string));
                   } catch(e) {
                     showToast('文件解析失败', 'error');
                   }
                };
                reader.readAsText(file);
              }} accept=".json" className="hidden" />
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
          {activeTool === 'news' && <GlobalNews />}
        </main>

        <footer className="mt-auto pt-4 border-t border-slate-900 text-center">
          <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
            Wealth Visualization Engine &copy; 2025 Professional Edition
          </p>
        </footer>
      </div>

      {/* 云端备份管理模态框 */}
      {showBackupList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowBackupList(false)}></div>
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-850/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-600/20 rounded-2xl">
                  <Database size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">云端备份库</h3>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">Cloud Storage Archives</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCloudBackupRequest}
                  disabled={isCloudLoading}
                  className="p-2.5 bg-brand-600/10 hover:bg-brand-600/20 text-brand-400 rounded-xl transition-all"
                  title="立即创建全量备份"
                >
                  {isCloudLoading ? <Loader2 size={20} className="animate-spin" /> : <CloudUpload size={20} />}
                </button>
                <button 
                  onClick={fetchBackupList}
                  disabled={isCloudLoading}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                  title="刷新列表"
                >
                  <RefreshCw size={20} className={isCloudLoading ? 'animate-spin' : ''} />
                </button>
                <button onClick={() => setShowBackupList(false)} className="p-2.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 border-b border-slate-800 flex gap-4">
              <div className="relative flex-1 group">
                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
                <input 
                  type="month" 
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-brand-500 transition-all"
                />
              </div>
              <button 
                onClick={() => setMonthFilter('')}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all"
              >
                全部
              </button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-3">
              {isCloudLoading && backups.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <Loader2 size={40} className="animate-spin text-brand-500/50" />
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Loading Archives...</p>
                </div>
              ) : filteredBackups.length > 0 ? (
                filteredBackups.map((date) => (
                  <div 
                    key={date}
                    onClick={() => setSelectedBackupDate(date)}
                    className={`group flex items-center justify-between p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                      selectedBackupDate === date 
                        ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_20px_rgba(14,165,233,0.1)]' 
                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedBackupDate === date ? 'border-brand-500 bg-brand-500' : 'border-slate-700'
                      }`}>
                        {selectedBackupDate === date && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold tracking-tight ${selectedBackupDate === date ? 'text-brand-400' : 'text-slate-200'}`}>
                          {date}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Full Data Snapshot</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteBackup(date); }}
                      className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="删除该备份"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-slate-700 space-y-4">
                  <Database size={48} className="opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-40 text-center">
                    当前月份暂无备份<br/>
                    <span className="text-[10px] lowercase font-normal">点击右上方按钮开始首个云端同步</span>
                  </p>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-850/50">
              <button 
                disabled={!selectedBackupDate || isCloudLoading}
                onClick={() => selectedBackupDate && handleRestoreBackup(selectedBackupDate)}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:grayscale text-white py-4 rounded-3xl font-black text-sm flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]"
              >
                {isCloudLoading ? <Loader2 size={18} className="animate-spin" /> : <CloudDownload size={18} />}
                同步并应用所选备份
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
