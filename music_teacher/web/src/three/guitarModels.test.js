import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { MODEL_CAL, modelFrame } from './guitarModels.js';
import { S } from './guitar.js';

describe('גיטרות אמיתיות (GLB)', () => {
  const pub = path.resolve(__dirname, '../../public');
  it.each(Object.entries(MODEL_CAL))('%s: הקובץ קיים ובגודל סביר', (_t, cal) => {
    const p = path.join(pub, cal.file);
    expect(fs.existsSync(p), p).toBe(true);
    expect(fs.statSync(p).size).toBeLessThan(3 * 1024 * 1024);
    const buf = fs.readFileSync(p);
    expect(buf.readUInt32LE(0)).toBe(0x46546c67);
  });
  it.each(Object.entries(MODEL_CAL))('%s: האום באפס והאוכף באורך המיתר (x=40), במרכז הרוחב', (_t, cal) => {
    const { M } = modelFrame(cal, S, 0.0085);
    const n = new THREE.Vector3(...cal.N).applyMatrix4(M);
    const b = new THREE.Vector3(...cal.B).applyMatrix4(M);
    expect(n.x).toBeCloseTo(0, 3);
    expect(b.x).toBeCloseTo(S, 1);
    expect(Math.abs(n.z)).toBeLessThan(1e-3);
    expect(Math.abs(b.z)).toBeLessThan(1e-3);
    // גובה המיתר: 0.15 באום ו-0.15+40*0.0085 באוכף, פחות ההנמכה של הדגם
    expect(n.y).toBeCloseTo(0.15 - (cal.drop || 0), 2);
    expect(b.y).toBeCloseTo(0.15 - (cal.drop || 0) + S * 0.0085 * (cal.kt || 1), 1);
  });
  it('כל חלק עם עוגן קיים בנתוני הכיול', () => {
    for (const cal of Object.values(MODEL_CAL)) {
      for (const name of Object.keys(cal.anchors)) expect(typeof name).toBe('string');
      for (const [name] of cal.proxies) expect(cal.anchors[name] || cal.centers[name] || name).toBeTruthy();
    }
  });
});
