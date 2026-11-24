// בדיקות טופס הקליטה – רק נתונים מומצאים
import { describe, expect, test } from 'vitest';
import { INTAKE_SECTIONS } from '../data/intakeSections';
import {
  addRow, buildSavePayload, clearDraft, draftKey, emptyIntake, MAX_ROWS, pickInitial, readDraft,
  removeRow, safeIntake, sectionStatus, setField, setRowField, writeDraft,
} from './intake';

const sec = (id) => INTAKE_SECTIONS.find((s) => s.id === id);

describe('rows', () => {
  test('add and remove', () => {
    let i = emptyIntake();
    i = addRow(i, 'tools');
    i = addRow(i, 'tools');
    expect(i.tools).toEqual([{ tool: '', purpose: '', monthlyCost: '' }, { tool: '', purpose: '', monthlyCost: '' }]);
    i = setRowField(i, 'tools', 1, 'tool', 'אקסל');
    i = removeRow(i, 'tools', 0);
    expect(i.tools).toHaveLength(1);
    expect(i.tools[0].tool).toBe('אקסל');
    i = addRow(i, 'missing');
    expect(i.missing).toEqual(['']);
    i = setRowField(i, 'missing', 0, null, 'תזכורות');
    expect(i.missing).toEqual(['תזכורות']);
  });
  test('does not mutate and caps rows', () => {
    const a = emptyIntake();
    const b = addRow(a, 'pains');
    expect(a.pains).toHaveLength(0);
    let c = b;
    for (let n = 0; n < 50; n++) c = addRow(c, 'pains');
    expect(c.pains).toHaveLength(MAX_ROWS);
  });
});

describe('sectionStatus', () => {
  test('flat section: empty, partial, filled', () => {
    let i = emptyIntake();
    expect(sectionStatus(i, sec('business'))).toBe('empty');
    i = setField(i, 'business', 'name', 'עסק בדוי');
    expect(sectionStatus(i, sec('business'))).toBe('partial');
    for (const [k, v] of [['field', 'תחום'], ['employees', '3'], ['roles', 'כולם עושים הכול']]) i = setField(i, 'business', k, v);
    expect(sectionStatus(i, sec('business'))).toBe('filled');
  });
  test('whitespace only counts as empty, zero counts as filled', () => {
    let i = setField(emptyIntake(), 'business', 'name', '   ');
    expect(sectionStatus(i, sec('business'))).toBe('empty');
    i = setField(i, 'business', 'employees', 0);
    expect(sectionStatus(i, sec('business'))).toBe('partial');
  });
  test('rows section', () => {
    let i = addRow(emptyIntake(), 'tools');
    expect(sectionStatus(i, sec('tools'))).toBe('empty');
    i = setRowField(i, 'tools', 0, 'tool', 'אקסל');
    expect(sectionStatus(i, sec('tools'))).toBe('partial');
    i = setRowField(setRowField(i, 'tools', 0, 'purpose', 'מעקב'), 'tools', 0, 'monthlyCost', 0);
    expect(sectionStatus(i, sec('tools'))).toBe('filled');
  });
  test('list section and optional note', () => {
    let i = addRow(emptyIntake(), 'missing');
    expect(sectionStatus(i, sec('missing'))).toBe('empty');
    i = setRowField(i, 'missing', 0, null, 'משהו');
    expect(sectionStatus(i, sec('missing'))).toBe('filled');
    let t = setField(setField(emptyIntake(), 'tech', 'maintain', 'yes'), 'tech', 'sensitive', 'no');
    expect(sectionStatus(t, sec('tech'))).toBe('partial');
    t = setField(setField(t, 'tech', 'decider', 'בעלים'), 'tech', 'dataLocation', 'אקסל');
    expect(sectionStatus(t, sec('tech'))).toBe('filled');
  });
});

describe('save payload and safeIntake', () => {
  test('payload wraps a cleaned intake', () => {
    let i = setField(emptyIntake(), 'business', 'employees', '12');
    i = setField(i, 'tech', 'maintain', 'whatever');
    i = { ...i, extra: 'x' };
    const p = buildSavePayload(i);
    expect(Object.keys(p)).toEqual(['client']);
    expect(p.client.intake.business.employees).toBe(12);
    expect(p.client.intake.tech.maintain).toBe('');
    expect(p.client.intake.extra).toBeUndefined();
  });
  test('old clients with empty intake get defaults', () => {
    expect(safeIntake({})).toEqual(emptyIntake());
    expect(safeIntake(undefined)).toEqual(emptyIntake());
  });
});

describe('draft', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  test('write, read, clear', () => {
    const i = setField(emptyIntake(), 'goal', 'success', 'פחות שעות');
    writeDraft('c1', i, 5000);
    expect(draftKey('c1')).toBe('pk_draft_c1');
    expect(readDraft('c1')).toEqual({ at: 5000, intake: i });
    clearDraft('c1');
    expect(readDraft('c1')).toBeNull();
  });
  test('draft wins only when newer than the server copy', () => {
    const draft = { at: 2000, intake: setField(emptyIntake(), 'goal', 'success', 'טיוטה') };
    expect(pickInitial({}, 1000, draft)).toEqual({ intake: draft.intake, fromDraft: true });
    expect(pickInitial({}, 3000, draft).fromDraft).toBe(false);
    expect(pickInitial({}, 3000, null).intake).toEqual(emptyIntake());
  });
  test('broken storage does not throw', () => {
    store['pk_draft_bad'] = '{not json';
    expect(readDraft('bad')).toBeNull();
  });
});
