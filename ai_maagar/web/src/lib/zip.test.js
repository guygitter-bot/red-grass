import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { crc32, makeZip } from './zip';

describe('zip', () => {
  it('crc32 of hello', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });
  it('has local header and end record with the entry count', () => {
    const z = makeZip([{ name: 'a/SKILL.md', text: 'שלום' }, { name: 'b.txt', text: 'x' }]);
    expect([...z.slice(0, 4)]).toEqual([0x50, 0x4b, 3, 4]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(2);
    expect(v.getUint16(6, true) & 0x0800).toBe(0x0800);
  });
  it('writes a file for external verification', () => {
    if (process.env.ZIP_OUT) fs.writeFileSync(process.env.ZIP_OUT, makeZip([{ name: 'my-skill/SKILL.md', text: '---\nname: my-skill\n---\nשלום עולם\n' }]));
  });
});
