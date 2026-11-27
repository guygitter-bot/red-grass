// מייל -> חשבונית מסודרת (Claude קורא את הטקסט ואת קובצי ה-PDF המצורפים).
// מחזיר null כשזה לא חשבונית / דרישת תשלום / קבלה.

export const MODEL = 'claude-sonnet-5-5';
const BETA = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

const INVOICE_TOOL = {
  name: 'record_invoice',
  description: 'Record what this email is: a bill/invoice/receipt for the household, or not.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      is_invoice: { type: 'boolean', description: 'true only for a bill, invoice, receipt or payment demand addressed to this household' },
      supplier: { type: 'string', description: 'Company name in its usual Hebrew (or brand) form, e.g. "חברת החשמל", "סלקום", "הראל", "Netflix"' },
      service: { type: 'string', description: 'What the charge is for, short Hebrew, e.g. "חשמל לבית", "סלולר", "ביטוח בריאות"' },
      category: { type: 'string', description: 'One of: דיור, חשבונות הבית, תקשורת, ביטוחים, רכב ותחבורה, ילדים וחינוך, בריאות, מנויים, הלוואות, מזון וקניות, אחר' },
      amount: { type: 'number', description: 'Total to pay / paid in ILS (0 if unknown)' },
      currency: { type: 'string' },
      invoice_date: { type: 'string', description: 'YYYY-MM-DD or empty' },
      period_from: { type: 'string', description: 'Billing period start YYYY-MM-DD or empty' },
      period_to: { type: 'string', description: 'Billing period end YYYY-MM-DD or empty' },
      due_date: { type: 'string', description: 'YYYY-MM-DD or empty' },
      account: { type: 'string', description: 'Customer/account/contract number at the supplier, or empty' },
      plan: { type: 'string', description: 'Tariff/plan/package name if shown, or empty' },
      items: {
        type: 'array',
        description: 'Line items / components of the bill with their amounts (max 15)',
        items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'number' } }, required: ['name', 'amount'], additionalProperties: false },
      },
      notes: { type: 'string', description: 'One short Hebrew line with anything notable: a price change notice, a one-time charge, a credit/refund, a debt, a discount ending. Empty if nothing.' },
    },
    required: ['is_invoice', 'supplier', 'service', 'category', 'amount', 'currency', 'invoice_date', 'period_from', 'period_to', 'due_date', 'account', 'plan', 'items', 'notes'],
    additionalProperties: false,
  },
};

const SYSTEM = `You read emails of an Israeli household and extract bills/invoices/receipts.
Use only what is in the email and its PDF attachments; never guess amounts. Marketing emails, newsletters,
order shipping updates without an amount due, and bank statements are NOT invoices (is_invoice=false).
Amounts in ILS (₪). Dates as YYYY-MM-DD. Always finish by calling record_invoice.`;

const clean = (s, n = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const isDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');

export function cleanInvoice(r) {
  if (!r || !r.is_invoice || !clean(r.supplier)) return null;
  const amount = Number(r.amount);
  return {
    supplier: clean(r.supplier, 60),
    service: clean(r.service, 80),
    category: clean(r.category, 40) || 'אחר',
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
    currency: clean(r.currency, 8) || '₪',
    invoiceDate: isDate(r.invoice_date),
    periodFrom: isDate(r.period_from),
    periodTo: isDate(r.period_to),
    dueDate: isDate(r.due_date),
    account: clean(r.account, 40),
    plan: clean(r.plan, 80),
    items: (Array.isArray(r.items) ? r.items : [])
      .slice(0, 15)
      .map((i) => ({ name: clean(i.name, 80), amount: Math.round(Number(i.amount) * 100) / 100 }))
      .filter((i) => i.name && Number.isFinite(i.amount)),
    notes: clean(r.notes, 200),
  };
}

// mail: { from, subject, date, text, pdfs: [{ name, data }] }
export async function extractInvoice(client, mail) {
  const content = [];
  for (const pdf of mail.pdfs.slice(0, 2)) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.data }, title: pdf.name });
  content.push({ type: 'text', text: `From: ${mail.from}\nSubject: ${mail.subject}\nDate: ${mail.date}\n\n${mail.text.slice(0, 12000)}` });
  const messages = [{ role: 'user', content }];
  for (let step = 0; step < 3; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...BETA,
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [INVOICE_TOOL],
      messages,
    });
    const call = response.content.find((b) => b.type === 'tool_use' && b.name === INVOICE_TOOL.name);
    if (call) return { invoice: cleanInvoice(call.input), usage: response.usage };
    if (response.stop_reason === 'refusal') return { invoice: null };
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: 'Call record_invoice now.' });
  }
  return { invoice: null };
}
