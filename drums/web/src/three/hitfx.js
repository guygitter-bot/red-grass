// אנימציות המכה לכל חלק: עור ששוקע ורועד, מעטפת שזזה מעט, מצילה שמתנדנדת (קפיץ מרוסן), היי-האט שנסגר,
// מקל הבס שמכה, והילה קצרה על החלק. בלי הקצאות זיכרון בכל פריים.
import * as THREE from 'three';

const CYM = new Set(['crash', 'ride', 'china', 'splash', 'xhat', 'hihat', 'cowbell']);
const BEATER_REST = 0.55;

// צבעי ההילה: מכה רגילה (ענבר-לבן), ומשוב בלימוד (ירוק / צהוב / אדום)
export const FLASH = {
  hit: new THREE.Color(3.2, 2.3, 1.3),
  'fb-perfect': new THREE.Color(0.3, 3.2, 0.9),
  'fb-good': new THREE.Color(3.0, 2.4, 0.2),
  'fb-miss': new THREE.Color(3.2, 0.3, 0.3),
};

export function startHit(e, amp = 1) {
  const a = e.anim || { t: 0, ang: 0, vel: 0, ang2: 0, vel2: 0 };
  a.t = 0;
  a.amp = amp;
  if (CYM.has(e.kind)) {
    // המכה בשפה הקרובה למתופף דוחפת אותה למטה; ספלאש קל זז יותר, רייד כבד פחות
    const k = e.kind === 'ride' ? 0.55 : e.kind === 'splash' ? 1.3 : e.kind === 'hihat' ? 0.25 : e.kind === 'cowbell' ? 0.5 : 1;
    a.vel += 1.5 * amp * k;
    a.vel2 += (Math.random() - 0.5) * 0.8 * amp * k;
  }
  e.anim = a;
}

// small = הילה קטנה במרכז (פעמון הרייד) במקום על כל החלק
export function startFlash(e, cls = 'hit', k = 1, small = false) {
  if (e.haloBase) e.halo.scale.setScalar(e.haloBase * (small ? 0.32 : 1));
  e.flashT = 0;
  e.flashK = k;
  e.flashColor.copy(FLASH[cls] || FLASH.hit);
  e.halo.visible = true;
}

// מחזיר true אם החלק עוד זז (כדי לדעת אם צריך לצייר עוד פריים)
export function stepPiece(e, dt, reduced) {
  let busy = false;
  const a = e.anim;
  if (a) {
    a.t += dt;
    const t = a.t;
    const amp = a.amp * (reduced ? 0.5 : 1);
    if (CYM.has(e.kind)) {
      // קפיץ מרוסן בשני צירים, בצעדים קטנים ליציבות
      const w = e.kind === 'ride' ? 7.2 : e.kind === 'splash' ? 11 : e.kind === 'hihat' ? 14 : 8.5;
      const k = w * w;
      const c = 2 * 0.075 * w;
      const n = Math.ceil(dt / 0.008);
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        a.vel += (-k * a.ang - c * a.vel) * h;
        a.ang += a.vel * h;
        a.vel2 += (-k * 1.15 * a.ang2 - c * a.vel2) * h;
        a.ang2 += a.vel2 * h;
      }
      e.body.rotation.x = a.ang;
      e.body.rotation.z = a.ang2;
      if (e.topCym && e.kind === 'hihat') {
        // ההיי-האט נסגר לרגע ונפתח שוב
        const close = t < 0.03 ? t / 0.03 : Math.exp(-(t - 0.03) * 22);
        e.topCym.position.y = -e.gap * 0.9 * close;
      }
      busy = Math.abs(a.ang) + Math.abs(a.vel) * 0.1 + Math.abs(a.ang2) > 0.0008 || t < 0.2;
    } else {
      const dip = 0.011 * amp * Math.exp(-t * 20) * Math.cos(t * 75);
      e.head.material.userData.dip.value = dip;
      const push = Math.exp(-t * 16);
      e.body.position.y = -0.005 * amp * push;
      e.body.rotation.z = 0.012 * amp * Math.exp(-t * 9) * Math.sin(t * 38);
      const glow = 0.35 * amp * Math.exp(-t * 9);
      e.head.material.emissive.setRGB(glow, glow * 0.8, glow * 0.55);
      if (e.beater) {
        const strike = t < 0.035 ? t / 0.035 : Math.exp(-(t - 0.035) * 11);
        e.beater.rotation.x = BEATER_REST - (BEATER_REST + 0.32) * strike;
      }
      busy = t < 0.7;
    }
    if (!busy) {
      e.anim = null;
      if (e.head) {
        e.head.material.userData.dip.value = 0;
        e.head.material.emissive.setRGB(0, 0, 0);
        e.body.position.y = 0;
        e.body.rotation.z = 0;
      } else {
        e.body.rotation.set(0, 0, 0);
        if (e.topCym) e.topCym.position.y = 0;
      }
      if (e.beater) e.beater.rotation.x = BEATER_REST;
    }
  }
  if (e.halo.visible) {
    e.flashT += dt;
    const o = Math.exp(-e.flashT * 4.5) * (e.flashK ?? 1);
    e.halo.material.color.copy(e.flashColor);
    e.halo.material.opacity = Math.min(1, o);
    if (o < 0.01) e.halo.visible = false;
    busy = true;
  }
  return busy;
}

// הדגשת לימוד: now = טבעת מגנטה חזקה שפועמת, soon = טבעת מקווקוות רכה
// hand: 'L' = טבעת תכלת (יד שמאל בתרגילי טכניקה), אחרת מגנטה (ימין / רגיל)
const HAND_COLOR = { R: new THREE.Color(3.2, 0.25, 1.4), L: new THREE.Color(0.2, 2.1, 3.0) };
export function setCue(e, cue, hand) {
  const key = cue ? `${cue}${hand || ''}` : null;
  if (e.cue === key) return;
  e.cue = key;
  const u = e.ring.material.uniforms;
  u.uColor.value.copy(HAND_COLOR[hand] || HAND_COLOR.R);
  e.ring.visible = !!cue;
  u.uDash.value = cue === 'soon' ? 1 : 0;
  u.uAlpha.value = cue === 'now' ? 1.6 : cue === 'soon' ? 0.7 : 0;
}
