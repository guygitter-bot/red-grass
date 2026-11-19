import { describe, expect, it } from 'vitest';
import { parseYouTubeId } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it('קישורים נפוצים', () => {
    const urls = [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://www.youtube.com/watch?feature=share&v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}&list=RDAMVM${ID}`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abc123`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}?start=3`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `https://www.youtube.com/v/${ID}`,
    ];
    for (const u of urls) expect(parseYouTubeId(u), u).toBe(ID);
  });
  it('בלי פרוטוקול, עם רווחים, ומזהה גולמי', () => {
    expect(parseYouTubeId(`youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`  youtu.be/${ID}  `)).toBe(ID);
    expect(parseYouTubeId(ID)).toBe(ID);
  });
  it('דוחה מה שאינו יוטיוב', () => {
    for (const bad of ['', '   ', null, undefined, 42, 'hello', 'https://example.com/watch?v=' + ID, 'https://www.youtube.com/', 'https://www.youtube.com/watch?v=short', 'https://youtu.be/', 'https://evil.com/youtu.be/' + ID, 'not a url at all !!']) {
      expect(parseYouTubeId(bad), String(bad)).toBe(null);
    }
  });
});
