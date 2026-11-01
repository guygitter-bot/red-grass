// נקודות הזרקה לבדיקות (Anthropic ו-fetch), משותפות לשרת ולעבודות ברקע
import Anthropic from '@anthropic-ai/sdk';

export const deps = {
  anthropic: (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
  fetch: (...args) => fetch(...args),
};

// לקוח AI שסופר טוקנים: כל קריאה מדווחת ל-onUsage({input, output}) – למעקב עלויות לפי ספר
// עלות בדולרים של שימוש ב-AI (מחירים לכל מיליון טוקנים / לכל חיפוש – אותם מחירים כמו במסך העלויות)
export function usdOf(env, { input = 0, output = 0, searches = 0 } = {}) {
  const price = { in: Number(env.AI_PRICE_IN || 5), out: Number(env.AI_PRICE_OUT || 25), search: Number(env.AI_PRICE_SEARCH || 0.01) };
  return (input * price.in + output * price.out) / 1e6 + searches * price.search;
}

export function trackedClient(env, onUsage) {
  const client = deps.anthropic(env);
  const create = client.beta.messages.create.bind(client.beta.messages);
  const wrapped = Object.create(client);
  wrapped.beta = Object.create(client.beta);
  wrapped.beta.messages = Object.create(client.beta.messages);
  let first = true; // הקריאה הראשונה של הלקוח = פעולה אחת (פעולה עם חיפוש ברשת עושה כמה קריאות)
  wrapped.beta.messages.create = async (params, ...rest) => {
    const res = await create(params, ...rest);
    const op = first;
    first = false;
    const u = res?.usage || {};
    const searches = u.server_tool_use?.web_search_requests || 0;
    await onUsage?.({
      input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      output: u.output_tokens || 0,
      searches,
      first: op,
    });
    return res;
  };
  return wrapped;
}
