// ברקוד -> ערכים תזונתיים.
// 1. זיהוי הברקוד (מצלמה או תמונה): BarcodeDetector של הדפדפן, ואם אין (אייפון) - ZXing ב-WebAssembly
//    שנטען רק כשצריך, מהאתר עצמו (בלי CDN).
// 2. חיפוש ב-Open Food Facts (מאגר פתוח וחינמי, כולל מוצרים ישראליים).
// 3. אם המוצר לא שם - הסוכן מחפש את הברקוד ברשת (researchFood), כמו מאכל שלא נמצא במאגר.

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

let detectorPromise = null;

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = FORMATS.filter((f) => supported.includes(f));
          if (formats.length) return new window.BarcodeDetector({ formats });
        } catch {
          // נופלים ל-ZXing
        }
      }
      const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
        import('barcode-detector/ponyfill'),
        import('zxing-wasm/reader/zxing_reader.wasm?url'),
      ]);
      prepareZXingModule({
        overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      });
      return new BarcodeDetector({ formats: FORMATS });
    })();
    detectorPromise.catch(() => {
      detectorPromise = null;
    });
  }
  return detectorPromise;
}

// מחזיר את מספר הברקוד שנמצא בתמונה / בפריים של הווידאו, או null
export async function detectBarcode(source) {
  const detector = await getDetector();
  const found = await detector.detect(source);
  const code = found.map((b) => b.rawValue).find((v) => isBarcode(v));
  return code || null;
}

export const cleanBarcode = (text) => String(text || '').replace(/\D/g, '');
export const isBarcode = (text) => /^\d{8,14}$/.test(cleanBarcode(text));

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};

// מוצר מ-Open Food Facts -> אותו מבנה כמו קריאת תווית (readNutritionLabel)
export function offToLabel(product) {
  const n = product?.nutriments || {};
  const per100 = {
    kcal: num(n['energy-kcal_100g']) ?? (num(n.energy_100g) != null ? Math.round(num(n.energy_100g) / 4.184) : null),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    fiber: num(n.fiber_100g) ?? 0,
  };
  // בלי חלבון / פחמימות / שומן אי אפשר לחשב נקודות
  if ([per100.protein, per100.carbs, per100.fat].some((v) => v == null)) return null;
  const name = product.product_name_he || product.product_name || product.generic_name || '';
  const brand = String(product.brands || '').split(',')[0].trim();
  const fullName = [name, brand && !name.includes(brand) ? brand : ''].filter(Boolean).join(' ').trim();
  return {
    readable: true,
    product_name: fullName,
    per100,
    serving_grams: num(product.serving_quantity) || null,
    units: [],
    source: 'openfoodfacts',
  };
}

export async function lookupBarcode(code) {
  const fields = 'product_name,product_name_he,generic_name,brands,nutriments,serving_quantity';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode(code)}.json?fields=${fields}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const data = await res.json();
  return data.status === 1 ? offToLabel(data.product) : null;
}
