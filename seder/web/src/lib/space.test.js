import { describe, expect, it } from 'vitest';
import { detectSpace, scoped } from './space';

describe('אפליקציה לאדם נוסף (מרחב)', () => {
  it('המרחב נלקח מהקישור, ובלי קישור – מהמכשיר', () => {
    expect(detectSpace('?u=AbCdEfGhIjKlMnOp', null)).toBe('AbCdEfGhIjKlMnOp');
    expect(detectSpace('', 'AbCdEfGhIjKlMnOp')).toBe('AbCdEfGhIjKlMnOp');
    expect(detectSpace('?u=AbCdEfGhIjKlMnOp', 'ZZZZZZZZZZZZZZZZ')).toBe('AbCdEfGhIjKlMnOp');
    expect(detectSpace('?text=שלום', null)).toBe('');
    expect(detectSpace('?u=קצר', 'גם-לא-תקין')).toBe('');
  });

  it('באפליקציה הראשית המפתחות במכשיר לא משתנים (הנתונים הקיימים נשמרים)', () => {
    expect(scoped('seder_v1', '')).toBe('seder_v1');
    expect(scoped('seder_v1', 'AbCdEfGhIjKlMnOp')).toBe('seder_v1@AbCdEfGhIjKlMnOp');
  });
});
