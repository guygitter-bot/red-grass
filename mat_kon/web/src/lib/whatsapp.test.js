import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { chatNameFromFile, findCandidates, looksLikeRecipe, parseChat, readChatFile, urlKey } from './whatsapp';

const RECIPE = `עוגת שמרים של סבתא
מצרכים:
3 כוסות קמח
1 כף שמרים
חצי כוס סוכר
2 ביצים
אופן ההכנה:
מערבבים הכל, מתפיחים שעה ואופים בתנור 180 מעלות 30 דקות`;

const ANDROID = `3.10.2026, 14:20 - ההודעות והשיחות מוצפנות מקצה לקצה.
3.10.2026, 14:21 - דנה: תראו איזה מתכון https://www.youtube.com/watch?v=abc123XYZ&si=x
3.10.2026, 14:22 - יוסי: <המדיה הושמטה>
3.10.2026, 14:23 - יוסי: ${RECIPE.split('\n').join('\n')}
3.10.2026, 14:24 - דנה: נפגשים פה https://maps.app.goo.gl/xyz
3.10.2026, 14:25 - רונית: https://youtu.be/abc123XYZ גם אני שמרתי!
3.10.2026, 14:26 - רונית: https://www.10dakot.co.il/recipe/x/.
3.10.2026, 14:27 - דני: https://news.example.com/article/1`;

const IOS = `[03/10/2026, 14:21:05] דנה: ‎תראו https://www.tiktok.com/@chef/video/1
[03/10/2026, 14:22:00] יוסי: ‎image omitted
[03/10/2026, 14:23:10] יוסי: שורה ראשונה
שורה שנייה`;

const US = `10/3/26, 2:21 PM - Dana: try this https://cake.example/choc-cake
10/3/26, 2:22 PM - Dana: yum`;

describe('parsing exported chats', () => {
  it('reads Android, iPhone and US formats, multi-line messages, skips system and media', () => {
    const a = parseChat(ANDROID);
    expect(a.map((m) => m.author)).toEqual(['דנה', 'יוסי', 'דנה', 'רונית', 'רונית', 'דני']);
    expect(a[1].text).toBe(RECIPE);
    const i = parseChat(IOS);
    expect(i).toHaveLength(2);
    expect(i[0].text).toBe('תראו https://www.tiktok.com/@chef/video/1');
    expect(i[1].text).toBe('שורה ראשונה\nשורה שנייה');
    expect(parseChat(US).map((m) => [m.author, m.time])).toEqual([['Dana', '2:21 PM'], ['Dana', '2:22 PM']]);
  });

  it('finds links once, written recipes, and marks saved ones', () => {
    const c = findCandidates(parseChat(ANDROID), { existingUrls: ['https://10dakot.co.il/recipe/x'] });
    expect(c.map((x) => x.type)).toEqual(['link', 'text', 'link', 'link']);
    const [yt, text, tenMin, news] = c;
    expect(yt.shares).toBe(2); // youtube.com ו-youtu.be הם אותו סרטון
    expect(yt.likely).toBe(true);
    expect(text.title).toBe('עוגת שמרים של סבתא');
    expect(tenMin.url).toBe('https://www.10dakot.co.il/recipe/x/');
    expect(tenMin.saved).toBe(true);
    expect(news.likely).toBe(false);
    expect(c.some((x) => x.url?.includes('maps'))).toBe(false);
  });

  it('counts a link shared twice once', () => {
    const msgs = parseChat(`1.1.2026, 10:00 - א: https://cake.example/a?utm_source=x\n1.1.2026, 10:01 - ב: https://cake.example/a`);
    const c = findCandidates(msgs);
    expect(c).toHaveLength(1);
    expect(c[0].shares).toBe(2);
    expect(urlKey('https://www.Cake.example/a/?utm_source=x#top')).toBe('cake.example/a');
    expect(urlKey('https://youtube.com/shorts/abc')).toBe(urlKey('https://www.youtube.com/watch?v=abc&si=1'));
  });

  it('tells recipes from chatter', () => {
    expect(looksLikeRecipe(RECIPE)).toBe(true);
    expect(looksLikeRecipe('מי מביא סוכר וקמח מחר לתנור של המתנ"ס? צריך כוס אחת בערך, תודה רבה לכולם, נתראה בשמונה בערב בדיוק כמו שסיכמנו בקבוצה')).toBe(false);
  });
});

describe('files', () => {
  it('names the chat from the file name', () => {
    expect(chatNameFromFile('WhatsApp Chat with מתכונים של המשפחה.txt')).toBe('מתכונים של המשפחה');
    expect(chatNameFromFile("צ'אט WhatsApp עם אמא.zip")).toBe('אמא');
    expect(chatNameFromFile('_chat.txt')).toBe('');
  });

  it('reads a plain text export and an iPhone zip', async () => {
    const txt = new File([ANDROID], 'WhatsApp Chat with אוכל.txt');
    expect((await readChatFile(txt)).text).toBe(ANDROID);
    const zip = zipSync({ '_chat.txt': strToU8(IOS) });
    const res = await readChatFile(new File([zip], 'WhatsApp Chat - אוכל.zip'));
    expect(res).toEqual({ name: 'אוכל', text: IOS });
  });
});
