// ניווט לפי ה-hash (כך כפתור "אחורה" בטלפון עובד): #/ · #/s/AAPL · #/portfolio · #/chat?q=... · #/learn?term=RSI
export function parseHash(hash = '') {
  const raw = String(hash).replace(/^#/, '') || '/';
  const [pathPart, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = pathPart.split('/').filter(Boolean);
  if (parts[0] === 's' && parts[1]) {
    let symbol = parts[1];
    try {
      symbol = decodeURIComponent(parts[1]);
    } catch {
      // משאירים כמו שהוא
    }
    return { name: 'stock', symbol: symbol.toUpperCase(), params };
  }
  const known = ['portfolio', 'chat', 'alerts', 'learn', 'settings'];
  return { name: known.includes(parts[0]) ? parts[0] : 'home', symbol: '', params };
}

export const stockLink = (symbol) => `#/s/${encodeURIComponent(symbol)}`;
export const chatLink = (text) => `#/chat?q=${encodeURIComponent(text)}`;
export const termLink = (term) => `#/learn?term=${encodeURIComponent(term)}`;
