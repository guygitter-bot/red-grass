// בונה את igskills.js: סקילי האינסטגרם שבמאגר (.claude/skills/ig-*) + הקול האישי והמסר של mat-kon (.claude/instagram),
// כדי שבוט האינסטגרם 📱 ישתמש בהם. רץ אוטומטית לפני כל עלייה (.github/workflows/tsevet.yml).
// הרצה ידנית: node build-igskills.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skillsDir = `${root}.claude/skills`;
const MAX_DATA = 22_000;

// "---\nname: x\ndescription: >-\n  ...\n---\nbody" -> { description, body }
function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { description: '', body: text };
  const desc = m[1].match(/description:\s*(?:>-?|\|)?\s*\n?([\s\S]*?)(?:\n\w+:|$)/);
  return { description: (desc?.[1] || '').replace(/\s+/g, ' ').trim(), body: m[2].trim() };
}

const skills = readdirSync(skillsDir)
  .filter((d) => d.startsWith('ig-') && existsSync(`${skillsDir}/${d}/SKILL.md`))
  .sort()
  .map((name) => {
    const dir = `${skillsDir}/${name}`;
    const { description, body } = parse(readFileSync(`${dir}/SKILL.md`, 'utf8'));
    const files = readdirSync(dir);
    // נתונים שהסקיל נשען עליהם (נוסחאות הוקים, מילים "של AI" וכו') – מצורפים לטקסט
    const data = files.filter((f) => f.endsWith('.json')).map((f) => {
      const raw = readFileSync(`${dir}/${f}`, 'utf8');
      return raw.length <= MAX_DATA ? `\n\n## Data: ${f}\n\`\`\`json\n${raw.trim()}\n\`\`\`` : '';
    }).join('');
    const scripts = files.filter((f) => f.endsWith('.py'));
    const note = scripts.length ? `\n\n> Note for the team bot: this skill mentions scripts (${scripts.join(', ')}). They can't run here – apply their rules yourself, using the data below.` : '';
    return { name, title: name, when: description.slice(0, 400), body: `${body}${note}${data}` };
  });

const doc = (file) => {
  try {
    return readFileSync(`${root}.claude/instagram/${file}`, 'utf8').trim();
  } catch {
    return '';
  }
};
const docs = [
  { name: 'ig-voice', title: 'הקול האישי', when: 'Before writing any caption, script, comment or DM in the owner\'s voice (if it is still the empty template, ask the owner for 3 of their own reels or captions)', body: doc('voice.md') },
  { name: 'mat-kon-message', title: 'המסר של mat-kon', when: 'Before any content about the mat-kon recipes app: the message, what is unique, what not to say', body: doc('mat-kon.md') },
].filter((d) => d.body);

const all = [...skills, ...docs];
const out = `// נוצר אוטומטית מ-build-igskills.mjs – לא לערוך ידנית.\nexport const IG_SKILLS = ${JSON.stringify(all, null, 1)};\n`;
writeFileSync(new URL('./igskills.js', import.meta.url), out);
console.log(`igskills.js: ${all.length} skills, ${Math.round(out.length / 1024)}KB`);
