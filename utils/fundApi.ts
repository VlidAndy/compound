
import { NAVPoint } from '../types';

/**
 * 通用脚本加载器：用于绕过 fetch 的 CORS 限制
 */
const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    script.charset = 'utf-8';
    script.onload = () => {
      document.body.removeChild(script);
      resolve();
    };
    script.onerror = () => {
      document.body.removeChild(script);
      reject(new Error(`Failed to load script: ${url}`));
    };
    document.body.appendChild(script);
  });
};

/**
 * 获取基金历史净值
 * 利用 <script> 标签加载后定义的全局变量 Data_netWorthTrend
 */
export const fetchFundData = async (code: string): Promise<NAVPoint[]> => {
  if (!code || code === 'CASH') return [];
  
  try {
    const targetUrl = `https://fund.eastmoney.com/pingzhongdata/${code}.js`;
    
    // 加载脚本，执行后会在 window 下挂载 Data_netWorthTrend
    await loadScript(targetUrl);
    
    const rawData = (window as any).Data_netWorthTrend;
    
    if (rawData && Array.isArray(rawData)) {
      return rawData.map((item: any) => ({
        timestamp: item.x,
        nav: item.y
      }));
    }
    
    // 如果没有单位净值，尝试寻找累计净值
    const fallbackData = (window as any).Data_ACWorthTrend;
    if (fallbackData && Array.isArray(fallbackData)) {
      return fallbackData.map((item: any) => ({ 
        timestamp: item[0], 
        nav: item[1] 
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error loading fund script ${code}:`, error);
    return [];
  }
};

/**
 * 获取实时估值 (使用 JSONP 模式)
 */
export const fetchRealtimeValuation = async (code: string): Promise<number | null> => {
  if (!code || code === 'CASH') return 1.0;
  
  return new Promise(async (resolve) => {
    const callbackName = 'jsonpgz';
    const targetUrl = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
    
    // 定义全局回调函数供 JS 调用
    (window as any)[callbackName] = (data: any) => {
      resolve(parseFloat(data.gsz));
      delete (window as any)[callbackName]; // 用完即删
    };

    try {
      await loadScript(targetUrl);
    } catch (e) {
      resolve(null);
    }
  });
};

/**
 * 寻找上周末（本周一之前最后一个交易日）的基准价
 */
export const findMondayBaseline = (history: NAVPoint[]): NAVPoint | null => {
  if (!history || history.length === 0) return null;
  
  const now = new Date();
  const day = now.getDay(); 
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.setDate(now.getDate() - diffToMonday));
  monday.setHours(0, 0, 0, 0);
  const mondayTs = monday.getTime();
  
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
