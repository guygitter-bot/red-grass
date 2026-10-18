import { describe, expect, it } from 'vitest';
import { autoCode, buildNote, cleanName, cleanNumber, patchesFor, searchShirts } from './shirt';

const LFC = { id: '1', team: 'Liverpool', teamHe: 'ליברפול', kind: 'club', type: 'Home', year: '2025/26', color: 'Red', colorHe: 'אדום', code: 'Liverpool-Home-26-Red', league: 'Premier League', leagueHe: 'הפרמייר ליג', country: 'England', longSleeve: true, tags: [] };
const ARG = { id: '2', team: 'Argentina', teamHe: 'ארגנטינה', kind: 'national', type: 'Away', year: '2026', color: 'Navy', code: 'Argentina-Away-26-Navy', league: 'CONMEBOL', longSleeve: false, tags: ['מונדיאל'] };

describe('product code', () => {
  it('Team-Type-Year-Color', () => {
    expect(autoCode({ team: 'Paris Saint-Germain', type: 'Third', year: '2025/26', color: 'black' })).toBe('ParisSaintGermain-Third-26-Black');
  });
});

describe('note for the seller', () => {
  it('matches the example from the spec', () => {
    expect(buildNote(LFC, { name: 'Israel', number: '10', patch: 'league', sleeve: 'long' })).toBe(
      'Liverpool-Home-26-Red-LongSleeve\nName: Israel\nNumber: 10\nAdd League Patches',
    );
  });
  it('skips what was not chosen', () => {
    expect(buildNote(ARG, {})).toBe('Argentina-Away-26-Navy');
    expect(buildNote(LFC, { name: '  ', number: 'x' })).toBe('Liverpool-Home-26-Red-ShortSleeve');
    expect(buildNote(ARG, { patch: 'worldcup' })).toBe('Argentina-Away-26-Navy\nAdd World Cup Patches');
    // פאץ' של קבוצה לא נכנס לנבחרת
    expect(buildNote(ARG, { patch: 'ucl' })).toBe('Argentina-Away-26-Navy');
  });
  it('patches by kind', () => {
    expect(patchesFor(LFC).map((p) => p.he)).toEqual(['ללא פאץ\'', 'ליגה', 'ליגת האלופות', 'הליגה האירופית', 'קונפרנס ליג']);
    expect(patchesFor(ARG).map((p) => p.he)).toEqual(['ללא פאץ\'', 'גביע העולם', 'ליגת האומות', 'יורו']);
  });
  it('cleans name and number', () => {
    expect(cleanName('Messi<script>')).toBe('Messiscript');
    expect(cleanName("O'Neil-Smith")).toBe("O'Neil-Smith");
    expect(cleanName('ישראל')).toBe('ישראל');
    expect(cleanNumber('1a07')).toBe('10');
  });
});

describe('search', () => {
  const all = [LFC, ARG];
  it('by team (English / Hebrew), type, year, color and code', () => {
    expect(searchShirts(all, 'ליברפול').map((s) => s.id)).toEqual(['1']);
    expect(searchShirts(all, 'liverpool home 26').map((s) => s.id)).toEqual(['1']);
    expect(searchShirts(all, 'חוץ').map((s) => s.id)).toEqual(['2']);
    expect(searchShirts(all, 'אדום').map((s) => s.id)).toEqual(['1']);
    expect(searchShirts(all, 'argentina-away-26').map((s) => s.id)).toEqual(['2']);
    expect(searchShirts(all, 'נבחרת').map((s) => s.id)).toEqual(['2']);
    expect(searchShirts(all, 'מונדיאל').map((s) => s.id)).toEqual(['2']);
    expect(searchShirts(all, '2026').map((s) => s.id)).toEqual(['2']);
  });
  it('filters', () => {
    expect(searchShirts(all, '', { kind: 'club' }).map((s) => s.id)).toEqual(['1']);
    expect(searchShirts(all, '', { league: 'CONMEBOL' }).map((s) => s.id)).toEqual(['2']);
  });
});
