// חיבור ל-Claude – רק מהשרת (המפתח ANTHROPIC_API_KEY הוא סוד של ה-Worker, לעולם לא בדפדפן)
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5-5';

// בבדיקות מעבירים AI_CLIENT מדומה
export const aiClient = (env) => env.AI_CLIENT || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// קריאה אחת: מחזירה את הטקסט שהמודל כתב
export async function ask(client, { system, user, maxTokens = 8000 }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
  });
  if (response.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { refusal: true });
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// שגיאות מה-API בעברית (בלי פרטים טכניים)
export function aiMessage(e) {
  const status = Number(e?.status) || 0;
  if (!status && e?.refusal) return 'Claude סירב לענות על הבקשה הזאת.';
  if (status === 429 || status === 529 || status >= 500) return 'יש עומס אצל Claude כרגע. נסו שוב בעוד דקה.';
  if (status === 401 || status === 403) return 'המפתח של Claude לא מוגדר בשרת.';
  return 'Claude לא זמין כרגע. נסו שוב מאוחר יותר.';
}
