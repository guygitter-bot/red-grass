// קישורי יוטיוב: חילוץ מזהה הסרטון (פונקציה טהורה) וטעינת ה-IFrame API

const ID = /^[A-Za-z0-9_-]{11}$/;

// מקבל קישור (watch?v=, youtu.be, shorts, embed, live, music.youtube.com) או מזהה גולמי; מחזיר מזהה או null
export function parseYouTubeId(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;
  if (ID.test(text)) return text;
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : 'https://' + text);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && ID.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && ID.test(v)) return v;
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
    if (m) return m[1];
  }
  return null;
}

let apiPromise = null;
// טוען את סקריפט ה-API פעם אחת ומחזיר את window.YT
export function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('youtube api'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}
