import { NAVPoint } from '../types';

export const fetchFundData = async (code: string): Promise<NAVPoint[]> => {
  if (!code || code === 'CASH') return [];
  
  try {
    const targetUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const text = await response.text();
    const match = text.match(/var Data_ACWorthTrend = (\[\[.*?\]\]);/);
    
    if (match && match[1]) {
      const data: [number, number][] = JSON.parse(match[1]);
      return data.map(([timestamp, nav]) => ({ timestamp, nav }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching fund ${code}:`, error);
    return [];
  }
};

/**
 * 获取实时估值 (天天基金接口)
 */
export const fetchRealtimeValuation = async (code: string): Promise<number | null> => {
  if (!code || code === 'CASH') return 1.0;
  try {
    const targetUrl = `http://fundgz.1234567.com.cn/js/${code}.js`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyUrl);
    const text = await response.text();
    // 匹配 jsonpgz({...})
    const match = text.match(/jsonpgz\((.*)\)/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      return parseFloat(data.gsz); // gsz 为实时估值
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * 寻找本周一（或上一个最近交易日）的基准价
 */
export const findMondayBaseline = (history: NAVPoint[]): NAVPoint | null => {
  if (!history || history.length === 0) return null;
  
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.setDate(now.getDate() - diffToMonday));
  monday.setHours(0, 0, 0, 0);
  
  const mondayTs = monday.getTime();
  
  // 寻找最接近周一的时间点
  // 逻辑：向后寻找第一个日期 <= 周一 且最接近的点
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const baseline = sorted.find(p => p.timestamp <= mondayTs);
  
  return baseline || sorted[sorted.length - 1]; // 如果周一没数据，取最近的
};

export const getCategoryName = (cat: string) => {
  const map: Record<string, string> = {
    gold: '黄金',
    stock: '股票',
    bond: '债券',
    cash: '货币'
  };
  return map[cat] || cat;
};
