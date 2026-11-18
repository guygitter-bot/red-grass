import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { colIndex, docKind, docToText, docxXmlToText, sheetXmlToCsv } from './docs';

const file = (name, bytes, type = '') => ({ name, type, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

describe('docs', () => {
  it('knows which documents it can send', () => {
    expect(docKind({ name: 'a.pdf' })).toBe('pdf');
    expect(docKind({ name: 'חוזה.DOCX' })).toBe('docx');
    expect(docKind({ name: 'data.xlsx' })).toBe('xlsx');
    expect(docKind({ name: 'list.csv' })).toBe('text');
    expect(docKind({ name: 'x.zip' })).toBe(null);
  });

  it('reads Word paragraphs', () => {
    expect(docxXmlToText('<w:p><w:r><w:t>שלום</w:t></w:r><w:r><w:t xml:space="preserve"> עולם</w:t></w:r></w:p><w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p>')).toBe('שלום עולם\nA & B');
  });

  it('reads Excel sheets as CSV with names', async () => {
    expect(colIndex('AB7')).toBe(27);
    expect(sheetXmlToCsv('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>12.5</v></c></row>', ['שכר דירה'])).toBe('שכר דירה,,12.5');
    const zip = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="הוצאות" sheetId="1"/></sheets></workbook>'),
      'xl/sharedStrings.xml': strToU8('<sst><si><t>חשמל</t></si><si><t>מים, ביוב</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>300</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>120</v></c></row></sheetData></worksheet>'),
    });
    expect(await docToText(file('budget.xlsx', zip))).toBe('## הוצאות\nחשמל,300\n"מים, ביוב",120');
  });

  it('reads plain text and CSV as is', async () => {
    expect(await docToText(file('a.csv', strToU8('שם,סכום\nא,1'), 'text/csv'))).toBe('שם,סכום\nא,1');
  });
});
