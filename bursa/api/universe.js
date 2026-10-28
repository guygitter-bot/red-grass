// המניות והמדדים שהשרת סורק כל הזמן (בנוסף למניות שבמעקב ובתיק).
// הסמלים לפי Yahoo Finance: מניה בתל אביב מסתיימת ב-".TA".

// מדדים ונכסים ל"מצב השוק"
export const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', emoji: '🇺🇸' },
  { symbol: '^IXIC', name: 'נאסד"ק', emoji: '💻' },
  { symbol: '^DJI', name: 'דאו ג\'ונס', emoji: '🏭' },
  { symbol: 'TA35.TA', name: 'ת"א 35', emoji: '🇮🇱' },
  { symbol: '^TA125.TA', name: 'ת"א 125', emoji: '🇮🇱' },
  { symbol: '^VIX', name: 'מדד הפחד (VIX)', emoji: '😨' },
  { symbol: 'ILS=X', name: 'דולר/שקל', emoji: '💵' },
  { symbol: '^TNX', name: 'אג"ח ארה"ב 10 שנים', emoji: '🏦' },
  { symbol: 'CL=F', name: 'נפט', emoji: '🛢️' },
  { symbol: 'GC=F', name: 'זהב', emoji: '🥇' },
  { symbol: 'BTC-USD', name: 'ביטקוין', emoji: '₿' },
];

// רשימת הסריקה להמלצות: מניות גדולות בארה"ב, תעודות סל על מדדים, ומניות ישראליות
export const UNIVERSE = [
  { symbol: 'SPY', name: 'תעודת סל S&P 500' },
  { symbol: 'QQQ', name: 'תעודת סל נאסד"ק 100' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'Nvidia' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AVGO', name: 'Broadcom' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway' },
  { symbol: 'JPM', name: 'JPMorgan' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'LLY', name: 'Eli Lilly' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'XOM', name: 'ExxonMobil' },
  { symbol: 'COST', name: 'Costco' },
  { symbol: 'WMT', name: 'Walmart' },
  { symbol: 'NFLX', name: 'Netflix' },
  { symbol: 'AMD', name: 'AMD' },
  { symbol: 'ORCL', name: 'Oracle' },
  { symbol: 'PLTR', name: 'Palantir' },
  { symbol: 'KO', name: 'Coca-Cola' },
  { symbol: 'DIS', name: 'Disney' },
  { symbol: 'TSM', name: 'TSMC' },
  { symbol: 'TEVA', name: 'טבע' },
  { symbol: 'CHKP', name: "צ'ק פוינט" },
  { symbol: 'NICE', name: 'נייס' },
  { symbol: 'WIX', name: 'Wix' },
  { symbol: 'CYBR', name: 'CyberArk' },
  { symbol: 'MNDY', name: 'monday.com' },
  { symbol: 'LUMI.TA', name: 'בנק לאומי' },
  { symbol: 'POLI.TA', name: 'בנק הפועלים' },
  { symbol: 'DSCT.TA', name: 'בנק דיסקונט' },
  { symbol: 'ESLT.TA', name: 'אלביט מערכות' },
  { symbol: 'ICL.TA', name: 'כיל' },
  { symbol: 'NVMI.TA', name: 'נובה' },
  { symbol: 'TSEM.TA', name: 'טאואר' },
  { symbol: 'BEZQ.TA', name: 'בזק' },
  { symbol: 'AZRG.TA', name: 'עזריאלי' },
];

export const NAMES = Object.fromEntries([...INDICES, ...UNIVERSE].map((x) => [x.symbol, x.name]));
