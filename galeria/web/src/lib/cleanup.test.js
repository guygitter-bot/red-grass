import { describe, it, expect } from 'vitest';
import { analyzeAll, potential, blurThreshold } from './cleanup.js';
import { sourceOf, topicOf } from './categories.js';
import * as demo from './demo.js';

const DAY = 86400000;

describe('categories', () => {
  it('detects the source from folder and name', () => {
    expect(sourceOf({ bucket: 'Screenshots' })).toBe('screenshot');
    expect(sourceOf({ bucket: 'צילומי מסך' })).toBe('screenshot');
    expect(sourceOf({ bucket: 'WhatsApp Images', path: 'Android/media/com.whatsapp/WhatsApp/Media/' })).toBe('whatsapp');
    expect(sourceOf({ bucket: 'Camera', path: 'DCIM/Camera/' })).toBe('camera');
    expect(sourceOf({ bucket: 'Download' })).toBe('download');
    expect(sourceOf({ bucket: 'Instagram' })).toBe('social');
    expect(sourceOf({})).toBe('other');
  });

  it('maps labels to a topic, old data without labels still works', () => {
    expect(topicOf({}, { labels: [['Dog', 0.9]] })).toBe('pets');
    expect(topicOf({}, { labels: [['Sky', 0.6], ['Food', 0.9]] })).toBe('food');
    expect(topicOf({}, {})).toBe('other');
    expect(topicOf({ bucket: 'Screenshots' }, null)).toBe('docs');
  });
});

describe('cleanup', () => {
  it('blur threshold is relative to the gallery', () => {
    expect(blurThreshold([])).toBe(0);
    expect(blurThreshold([300, 300, 300])).toBe(54);
    expect(blurThreshold([10, 20, 30])).toBe(12);
  });

  it('finds blurry, dark, old screenshots and skips favorites and kept', () => {
    const now = 1000 * DAY;
    const photos = [
      { id: '1', date: now, size: 100 },
      { id: '2', date: now, size: 100 },
      { id: '3', date: now, size: 100 },
      { id: '4', date: now - 40 * DAY, size: 100, bucket: 'Screenshots' },
      { id: '5', date: now - 5 * DAY, size: 100, bucket: 'Screenshots' },
      { id: '6', date: now, size: 100, fav: true },
      { id: '7', date: now, size: 100 },
    ];
    const feats = {
      1: { sharp: 300, bright: 120 },
      2: { sharp: 2, bright: 120 },
      3: { sharp: 300, bright: 10 },
      4: { sharp: 1, bright: 200 },
      6: { sharp: 1, bright: 120 },
      7: { sharp: 1, bright: 120 },
    };
    const r = analyzeAll(photos, feats, { now, kept: new Set(['7']) });
    expect(r.lists.blurry).toEqual(['2']);
    expect(r.lists.dark).toEqual(['3']);
    expect(r.lists.screenshots).toEqual(['4']);
    expect(r.bySource.screenshot).toEqual(['4', '5']);
    const pot = potential(r, () => 100);
    expect(pot).toEqual({ count: 3, bytes: 300 });
  });

  it('works on the demo gallery', async () => {
    const photos = await demo.list();
    const feats = {};
    for (const f of await demo.analyze(photos.map((p) => p.id))) feats[f.id] = f;
    const r = analyzeAll(photos, feats, { now: Date.UTC(2026, 10, 1) });
    expect(photos.length).toBeGreaterThan(80);
    expect(r.dup.length).toBeGreaterThan(0);
    expect(r.similar.length).toBeGreaterThan(0);
    expect(r.lists.blurry.length).toBeGreaterThan(0);
    expect(r.lists.dark.length).toBeGreaterThan(0);
    expect(Object.keys(r.byTopic).length).toBeGreaterThan(4);
  });
});
