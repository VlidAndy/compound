import { NAVPoint } from '../types';

export const fetchFundData = async (code: string): Promise<NAVPoint[]> => {
  if (!code || code === 'CASH') return [];
  
  try {
    // 使用公共 CORS 代理解决浏览器跨域限制问题
    const targetUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const text = await response.text();
    
    // 正则提取 Data_ACWorthTrend = [[时间戳, 净值], ...]
    // 东方财富返回的是 JS 变量定义，需要通过正则截取
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

export const getCategoryName = (cat: string) => {
  const map: Record<string, string> = {
    gold: '黄金',
    stock: '股票',
    bond: '债券',
    cash: '货币'
  };
  return map[cat] || cat;
};