// בניית מתכון ממקור (קישור / טקסט / תמונות): משותף לבקשה רגילה ולעבודה ברקע (Durable Object alarm)
import { gatherSource } from './source.js';
import { NoRecipeError, aiMessage, extractRecipe } from './extract.js';
import { deps } from './deps.js';

export async function buildRecipe(env, client, { link, text, hint }, categories) {
  const src = text || (await gatherSource(link, deps.fetch, { hint, igDocId: env.IG_DOC_ID }));
  return extractRecipe(client, src, { categories });
}

// שגיאה -> {status, error} בעברית
export function failure(e, { isPhoto = false, owner = false } = {}) {
  if (e instanceof NoRecipeError) return { status: 422, error: e.message };
  const friendly = aiMessage(e, { owner });
  if (friendly) return { status: 503, error: friendly };
  if (e?.status === 400 && isPhoto) return { status: 400, error: 'לא הצלחתי לקרוא את התמונות. נסו תמונה ברורה יותר.' };
  return { status: 502, error: e?.status ? 'לא הצלחתי להוציא מתכון. נסו שוב.' : `לא הצלחתי להוציא מתכון: ${e?.message || e}` };
}
