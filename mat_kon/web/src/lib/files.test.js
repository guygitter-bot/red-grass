import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  decodeText, docxXmlToText, fileCandidates, fixReversedHebrew, htmlToText, legacyDocToText, odtXmlToText,
  pageItemsToText, readRecipeFile, rtfToText, splitDocument,
} from './files';

const RECIPE = 'עוגת שוקולד\n\nמצרכים:\n2 כוסות קמח\nכוס סוכר\n3 ביצים\n\nאופן ההכנה:\nמערבבים ואופים בתנור 180 מעלות';
const file = (bytes, name) => new File([bytes], name);

describe('reading files', () => {
  it('Word (.docx): paragraphs, tabs and line breaks', async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>עוגת שוקולד</w:t></w:r></w:p><w:p><w:r><w:t>2 כוסות</w:t><w:tab/><w:t xml:space="preserve"> קמח &amp; סוכר</w:t></w:r></w:p><w:p><w:r><w:t>שורה</w:t><w:br/><w:t>שנייה</w:t></w:r></w:p></w:body></w:document>';
    expect(docxXmlToText(xml)).toBe('עוגת שוקולד\n2 כוסות קמח & סוכר\nשורה\nשנייה');
    const docx = zipSync({ 'word/document.xml': strToU8(xml), '[Content_Types].xml': strToU8('<x/>') });
    const read = await readRecipeFile(file(docx, 'עוגה.docx'));
    expect(read).toEqual({ name: 'עוגה', text: 'עוגת שוקולד\n2 כוסות קמח & סוכר\nשורה\nשנייה' });
  });

  it('OpenDocument (.odt)', async () => {
    const xml = '<office:text><text:h>מרק</text:h><text:p>2<text:s/>גזרים<text:line-break/>מלח</text:p></office:text>';
    expect(odtXmlToText(xml)).toBe('מרק\n2 גזרים\nמלח');
    const read = await readRecipeFile(file(zipSync({ 'content.xml': strToU8(xml), mimetype: strToU8('application/vnd.oasis.opendocument.text') }), 'מרק.odt'));
    expect(read.text).toBe('מרק\n2 גזרים\nמלח');
  });

  it('RTF in Hebrew (Windows-1255 and \\u)', async () => {
    const rtf = "{\\rtf1\\ansi\\ansicpg1255{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0;}\\f0 \\'f2\\'e5\\'e2\\'e4\\par 2 \\u1499?\\u1493?\\u1505?\\u1493?\\u1514? \\'f7\\'ee\\'e7}";
    expect(rtfToText(rtf)).toBe('עוגה\n2 כוסות קמח');
    const bytes = Uint8Array.from(rtf, (c) => c.charCodeAt(0));
    expect((await readRecipeFile(file(bytes, 'a.rtf'))).text).toBe('עוגה\n2 כוסות קמח');
  });

  it('old Word (.doc): the UTF-16 text inside', async () => {
    const text = 'עוגת גבינה\r2 כוסות קמח\r100 גרם חמאה';
    const body = new Uint8Array(text.length * 2);
    [...text].forEach((c, i) => { body[i * 2] = c.charCodeAt(0) & 0xff; body[i * 2 + 1] = c.charCodeAt(0) >> 8; });
    const bytes = new Uint8Array(600 + body.length + 100);
    bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    bytes.set(body, 600);
    expect(legacyDocToText(bytes)).toBe('עוגת גבינה\n2 כוסות קמח\n100 גרם חמאה');
    expect((await readRecipeFile(file(bytes, 'old.doc'))).text).toContain('100 גרם חמאה');
  });

  it('text in UTF-8, UTF-16 and old Hebrew encoding', async () => {
    expect(decodeText(strToU8('שלום'))).toBe('שלום');
    expect(decodeText(Uint8Array.from([0xf9, 0xec, 0xe5, 0xed]))).toBe('שלום'); // Windows-1255
    expect(decodeText(Uint8Array.from([0xff, 0xfe, 0xe9, 0x05, 0xdc, 0x05]))).toBe('של');
    expect((await readRecipeFile(file(strToU8(RECIPE), 'r.txt'))).text).toBe(RECIPE);
  });

  it('a saved web page and an e-book', async () => {
    const html = '<html><head><style>x{}</style><title>t</title></head><body><h1>פשטידה</h1><ul><li>3 ביצים</li><li>גבינה</li></ul><script>bad()</script><p>אופים&nbsp;30 דקות</p></body></html>';
    expect(htmlToText(html)).toBe('פשטידה\n\n• 3 ביצים\n• גבינה\n\nאופים 30 דקות');
    expect((await readRecipeFile(file(strToU8(html), 'page.html'))).text).toContain('• 3 ביצים');
    const epub = zipSync({ 'META-INF/container.xml': strToU8('<x/>'), 'OEBPS/ch2.xhtml': strToU8('<p>שני</p>'), 'OEBPS/ch1.xhtml': strToU8('<p>ראשון</p>') });
    expect((await readRecipeFile(file(epub, 'book.epub'))).text).toBe('ראשון\n\nשני');
  });

  it('clear messages for Pages, password-free errors and unknown files', async () => {
    await expect(readRecipeFile(file(zipSync({ 'Index/Document.iwa': new Uint8Array(3), 'preview.jpg': new Uint8Array(3) }), 'a.pages'))).rejects.toThrow(/PDF או Word/);
    await expect(readRecipeFile(file(new Uint8Array(0), 'a.txt'))).rejects.toThrow(/ריק/);
    await expect(readRecipeFile(file(Uint8Array.from({ length: 500 }, (_, i) => i % 9), 'a.bin'))).rejects.toThrow(/PDF, Word/);
  });
});

describe('PDF text', () => {
  it('lines by height, Hebrew right to left, gaps become paragraphs', () => {
    const it = (str, x, y) => ({ str, transform: [10, 0, 0, 10, x, y], width: 20, height: 10 });
    const text = pageItemsToText([it('קמח', 100, 500), it('2 כוסות', 200, 500), it('ביצים', 200, 488), it('אופים', 200, 440)]);
    expect(text).toBe('2 כוסות קמח\nביצים\n\nאופים');
    // חלקים צמודים בלי רווח, וסוגריים שנשמרו הפוכים
    const at = (str, x, w) => ({ str, transform: [10, 0, 0, 10, x, 400], width: w, height: 10 });
    const tight = pageItemsToText([at(')', 300, 5), at('לבן', 270, 30), at('(', 262, 8), at('סוכר', 315, 30)]);
    expect(tight).toBe('סוכר (לבן)');
  });

  it('reversed Hebrew is turned around', () => {
    const reversed = 'םיציב 3\nחמק תוסוכ 2\nםימ סוכ\nןמש ףכ\nרונת)';
    expect(fixReversedHebrew(reversed)).toBe('3 ביצים\n2 כוסות קמח\nכוס מים\nכף שמן\n(תנור');
    expect(fixReversedHebrew('3 ביצים\nכוס מים\nשמן')).toBe('3 ביצים\nכוס מים\nשמן');
  });
});

describe('splitting a cookbook', () => {
  it('a short file is one part; a long one splits at titles', () => {
    expect(splitDocument(RECIPE)).toEqual([RECIPE]);
    const book = Array.from({ length: 12 }, (_, i) => `מתכון מספר ${i + 1}\n${Array(20).fill('2 כוסות קמח\nמערבבים ואופים בתנור').join('\n')}`).join('\n\n');
    const parts = splitDocument(book);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 6000)).toBe(true);
    expect(parts.every((p) => /^מתכון מספר \d+/.test(p))).toBe(true);
    expect(parts.join('\n\n')).toBe(book);
  });

  it('candidates: parts with an id that remembers what was already added, scanned pages as photos', () => {
    const items = fileCandidates({ name: 'חוברת', parts: [RECIPE, 'תוכן העניינים\nעמוד 1\nעמוד 2'] });
    expect(items.map((i) => [i.type, i.title, i.likely, i.date])).toEqual([
      ['text', 'עוגת שוקולד', true, 'חלק 1 מתוך 2'],
      ['text', 'תוכן העניינים', false, 'חלק 2 מתוך 2'],
    ]);
    expect(fileCandidates({ name: 'x', parts: [RECIPE] }, { existingKeys: [items[0].id] })[0].saved).toBe(true);
    const pages = fileCandidates({ name: 'סריקה', pages: [{ images: ['data:image/jpeg;base64,AA'], thumb: 't', label: 'עמוד 1' }] });
    expect(pages[0]).toMatchObject({ type: 'photo', title: 'עמוד 1', likely: true, images: ['data:image/jpeg;base64,AA'] });
  });
});
