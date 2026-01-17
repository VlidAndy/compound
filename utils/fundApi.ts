
import { NAVPoint } from '../types';

export const fetchFundData = async (code: string): Promise<NAVPoint[]> => {
  if (!code || code === 'CASH') return [];
  
  try {
    const targetUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const text = await response.text();
    
    // Data_netWorthTrend 为单位净值
    const match = text.match(/var Data_netWorthTrend = (\[\{.*?\}\]);/);
    
    if (match && match[1]) {
      const rawData = JSON.parse(match[1]);
      return rawData.map((item: any) => ({
        timestamp: item.x,
        nav: item.y
      }));
    }
    
    const fallbackMatch = text.match(/var Data_ACWorthTrend = (\[\[.*?\]\]);/);
    if (fallbackMatch && fallbackMatch[1]) {
      const data: [number, number][] = JSON.parse(fallbackMatch[1]);
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
    const match = text.match(/jsonpgz\((.*)\)/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      return parseFloat(data.gsz);
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * 寻找上周末（本周一之前最后一个交易日）的基准价
 */
export const findMondayBaseline = (history: NAVPoint[]): NAVPoint | null => {
  if (!history || history.length === 0) return null;
  
  const now = new Date();
  const day = now.getDay(); 
  // 获取本周一 00:00:00 的时间戳
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.setDate(now.getDate() - diffToMonday));
  monday.setHours(0, 0, 0, 0);
  const mondayTs = monday.getTime();
  
  // 核心修正：寻找严格小于(之前)周一 00:00 的最后一个点
  // 这样就能捕捉到上周五（或上周末）的收盘价
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const baseline = sorted.find(p => p.timestamp < mondayTs);
  
  return baseline || sorted[sorted.length - 1]; 
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
