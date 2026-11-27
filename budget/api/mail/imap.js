// לקוח IMAP מינימלי (רק מה שצריך כדי לקרוא חשבוניות מ-Gmail): התחברות, חיפוש, הורדת מייל, יציאה.
// החיבור: TLS ל-imap.gmail.com:993 דרך cloudflare:sockets. בבדיקות מעבירים connect מדומה.

const enc = new TextEncoder();
const latin1 = new TextDecoder('latin1');

export class Imap {
  constructor(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buf = new Uint8Array(0);
    this.tag = 0;
  }

  static async open(connect, host = 'imap.gmail.com', port = 993) {
    const imap = new Imap(connect({ hostname: host, port }, { secureTransport: 'on', allowHalfOpen: false }));
    const greeting = await imap.line();
    if (!/^\* (OK|PREAUTH)/.test(latin1.decode(greeting))) throw new Error('imap greeting');
    return imap;
  }

  async more() {
    const { value, done } = await this.reader.read();
    if (done) throw new Error('imap closed');
    const next = new Uint8Array(this.buf.length + value.length);
    next.set(this.buf);
    next.set(value, this.buf.length);
    this.buf = next;
  }

  // שורה אחת (בלי CRLF), כבתים
  async line() {
    for (;;) {
      const i = this.buf.findIndex((b, k) => b === 13 && this.buf[k + 1] === 10);
      if (i >= 0) {
        const out = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        return out;
      }
      await this.more();
    }
  }

  async bytes(n) {
    while (this.buf.length < n) await this.more();
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }

  // פקודה: parts = מחרוזות; מחרוזת עם עברית נשלחת כ-literal ({n}). מחזיר { lines, literals } או זורק אם לא OK
  async command(...parts) {
    const tag = `A${++this.tag}`;
    const chunks = [];
    let cur = `${tag} `;
    for (const p of parts) {
      if (typeof p === 'object' && p.literal != null) {
        const data = enc.encode(p.literal);
        chunks.push(`${cur}{${data.length}}`);
        chunks.push(data);
        cur = '';
      } else cur += p;
    }
    chunks.push(cur);
    // שולחים: כל literal מחכה ל"+" מהשרת
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (c instanceof Uint8Array) {
        await this.writer.write(c);
        continue;
      }
      await this.writer.write(enc.encode(`${c}\r\n`));
      if (i + 1 < chunks.length && chunks[i + 1] instanceof Uint8Array) {
        const cont = latin1.decode(await this.line());
        if (!cont.startsWith('+')) throw new Error(`imap: ${cont.slice(0, 80)}`);
      }
    }
    const lines = [];
    const literals = [];
    for (;;) {
      const raw = await this.line();
      const text = latin1.decode(raw);
      if (text.startsWith(`${tag} `)) {
        if (!/^\S+ OK/.test(text)) throw Object.assign(new Error(text.slice(tag.length + 1, 200)), { imap: true });
        return { lines, literals };
      }
      const m = text.match(/\{(\d+)\}$/);
      if (m) literals.push(await this.bytes(Number(m[1])));
      lines.push(text);
    }
  }

  async login(user, pass) {
    await this.command('LOGIN ', quote(user), ' ', quote(pass));
  }

  // תיקיית "כל הדואר" של Gmail (השם תלוי בשפה), ואם לא נמצאה – INBOX
  async selectAll() {
    let box = 'INBOX';
    try {
      const { lines } = await this.command('LIST "" "*"');
      const all = lines.find((l) => /\\All\b/.test(l));
      const m = all && all.match(/"([^"]+)"\s*$|\s(\S+)$/);
      if (m) box = m[1] || m[2];
    } catch {
      // נשארים עם INBOX
    }
    await this.command('SELECT ', quote(box));
    return box;
  }

  // חיפוש בתחביר של Gmail (X-GM-RAW) -> מספרי UID
  async searchGmail(query) {
    const { lines } = await this.command('UID SEARCH CHARSET UTF-8 X-GM-RAW ', { literal: query });
    const line = lines.find((l) => l.startsWith('* SEARCH')) || '';
    return line.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean).map(Number);
  }

  // המייל המלא (בלי לסמן כנקרא)
  async fetch(uid) {
    const { literals } = await this.command(`UID FETCH ${uid} (BODY.PEEK[])`);
    return literals[0] || null;
  }

  async logout() {
    try {
      await this.command('LOGOUT');
    } catch {
      // לא חשוב
    }
    try {
      await this.socket.close();
    } catch {
      // לא חשוב
    }
  }
}

function quote(s) {
  return `"${String(s).replace(/(["\\])/g, '\\$1')}"`;
}
