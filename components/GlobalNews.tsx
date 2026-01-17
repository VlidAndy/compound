
import React from 'react';
import { TrendingUp, Globe, ExternalLink, ShieldCheck, Landmark, Wallet, Newspaper, Zap, Bell, Search } from 'lucide-react';

const NEWS_SOURCES = [
  {
    category: 'stock',
    label: '权益市场与权益衍生品',
    icon: TrendingUp,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    links: [
      { name: '华尔街见闻-股市', url: 'https://wallstreetcn.com/news/shares', desc: '全球视野下的 A 股、港股、美股实时快讯' },
      { name: '东方财富网-基金频道', url: 'https://fund.eastmoney.com/', desc: '国内最权威的公募基金净值与资讯平台' },
      { name: '雪球-社区热门', url: 'https://xueqiu.com/', desc: '投资者深度研报与市场情绪监测' }
    ],
    desc: '关注经济增长预期、企业盈利能力及风险溢价变化。'
  },
  {
    category: 'bond',
    label: '利率债与信用债市场',
    icon: Landmark,
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
    links: [
      { name: '中债收益率曲线', url: 'https://www.chinabond.com.cn/', desc: '中国债券市场基准利率锚点' },
      { name: '英为财情-十年期美债', url: 'https://cn.investing.com/rates-bonds/u.s.-10-year-bond-yield', desc: '全球资产定价之锚，流动性终极风向标' },
      { name: '财联社-债市快讯', url: 'https://www.cls.cn/subject/1012', desc: '固收市场实时动态与政策解读' }
    ],
    desc: '通缩压力、降息周期与宏观流动性的核心观测点。'
  },
  {
    category: 'gold',
    label: '避险资产与大宗商品',
    icon: ShieldCheck,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    links: [
      { name: 'KITCO 全球金价', url: 'https://www.kitco.com/charts/livegold.html', desc: '24小时全球黄金/白银现货报价' },
      { name: '金十数据-避险情报', url: 'https://www.jin10.com/', desc: '地缘政治、避险情绪与大类资产异动监测' },
      { name: '新浪财经-期货中心', url: 'https://finance.sina.com.cn/futuremarket/', desc: '原油、黄金及各类大宗商品期货动态' }
    ],
    desc: '监测通胀预期、货币信用危机与地缘政治冲突。'
  },
  {
    category: 'macro',
    label: '宏观政策与央行动态',
    icon: Wallet,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    links: [
      { name: '中国人民银行-公开市场操作', url: 'http://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html', desc: '每日流动性投放与逆回购操作记录' },
      { name: '美联储观察 (FedWatch)', url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', desc: '市场对美联储利率路径的预期分布' },
      { name: '格隆汇-宏观', url: 'https://www.gelonghui.com/macro', desc: '深度宏观经济数据解读与全球政策跟踪' }
    ],
    desc: '关注市场现金流紧缺度、基准利率及货币政策导向。'
  }
];

export const GlobalNews: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* 头部大面板 */}
      <div className="relative p-10 rounded-[3rem] bg-slate-900/60 border border-slate-800 backdrop-blur-3xl overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-brand-500/20 rounded-xl text-brand-400">
                 <Newspaper size={24} />
               </div>
               <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.3em]">Institutional Grade Intel</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter">全球宏观情报库</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
              汇集全球核心金融市场资讯源，为您提供资产配置决策背后的底层逻辑。通过监测利率、通胀与流动性，在波动中寻找确定的价值锚点。
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
             <div className="bg-slate-950/80 px-6 py-4 rounded-3xl border border-white/5 flex flex-col items-center min-w-[120px]">
                <span className="text-[10px] font-black text-slate-600 uppercase mb-1">活跃源</span>
                <span className="text-2xl font-mono font-black text-white">12+</span>
             </div>
             <div className="bg-slate-950/80 px-6 py-4 rounded-3xl border border-white/5 flex flex-col items-center min-w-[120px]">
                <span className="text-[10px] font-black text-slate-600 uppercase mb-1">更新频率</span>
                <span className="text-2xl font-mono font-black text-emerald-400">REAL</span>
             </div>
          </div>
        </div>
        
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-[50%] h-[150%] bg-brand-500/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 blur-[60px] rounded-full"></div>
      </div>

      {/* 资讯卡片网格 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {NEWS_SOURCES.map((source) => (
          <div key={source.category} className="group bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 hover:border-slate-600 transition-all duration-500 flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${source.bg} ${source.color} shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                  <source.icon size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">{source.label}</h3>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Market Monitor</p>
                </div>
              </div>
              <div className="hidden sm:block">
                 <div className="flex -space-x-2">
                   {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800"></div>)}
                 </div>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-8 italic opacity-80 border-l-2 border-slate-800 pl-4">
              {source.desc}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4 flex-1">
              {source.links.map((link) => (
                <a 
                  key={link.name} 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col p-5 rounded-2xl bg-slate-950/40 border border-white/5 hover:bg-brand-500/5 hover:border-brand-500/30 transition-all group/link"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-black text-slate-200 group-hover/link:text-brand-400 transition-colors">
                      {link.name}
                    </span>
                    <ExternalLink size={14} className="text-slate-600 group-hover/link:text-brand-500 transition-colors" />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    {link.desc}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 底部友情提示 */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Bell className="text-amber-400" size={20} />
          <p className="text-xs text-slate-500 font-medium">
            <span className="text-slate-300 font-bold">提示：</span> 宏观研究不决定短期走势，但决定长期赔率。建议在“定投决策引擎”执行前先行审阅以上资讯。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-white/5">
             <button className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">全部源</button>
             <button className="px-4 py-2 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">收藏夹</button>
          </div>
        </div>
      </div>
    </div>
  );
};
