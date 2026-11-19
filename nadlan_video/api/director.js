// הבמאי: Claude מסתכל על התמונות (עד 20: צילומים, הדמיות ושרטוטים) וכותב רשימת שוטים לסרטון תדמית.
// לכל שוט: כותרת והסבר בעברית + הוראה באנגלית לפריים הפתיחה (מחולל התמונות) + הוראה באנגלית לתנועת המצלמה (מחולל הווידאו).
import { KINDS, LOOKS, STYLES, SHOTS, MAX_SHOTS, shotsFor } from './brief.js';

export const MODEL = 'claude-opus-5-5';

export const PLAN_TOOL = {
  name: 'shot_list',
  description: 'Give the real-estate marketer your read of the property and the shot list for the promo film.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Hebrew, 1-2 sentences: what you see in the material (building type, floors, style, or the apartment layout) and the idea of the film' },
      shots: {
        type: 'array',
        description: `Exactly the number of shots the system prompt asks for (${SHOTS} to ${MAX_SHOTS}), in the order they appear in the film`,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Hebrew, 2-4 words' },
            why: { type: 'string', description: 'Hebrew, one sentence: what the viewer sees and feels in this shot' },
            sources: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Numbers of the supplied images (IMAGE 1, IMAGE 2...) this opening frame is built from: the first is the main source, at most two more may follow as extra references of the same space. Use the image that really shows this space or angle.',
            },
            still: {
              type: 'string',
              description: 'English instruction for an image model that receives the source image and must return the photorealistic opening frame of this shot. Empty string ONLY when the main source is a PHOTO that is already a finished, photorealistic, well-composed frame that should be used untouched.',
            },
            motion: { type: 'string', description: 'English prompt for an image-to-video model: one continuous camera move starting from the opening frame, plus the living details in the scene and the ambient sound' },
          },
          required: ['title', 'why', 'sources', 'still', 'motion'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary', 'shots'],
    additionalProperties: false,
  },
};

// kinds: סוג כל תמונה לפי הסדר – 'photo' (צילום / הדמיה) או 'plan' (שרטוט)
export function planSystem(brief, kinds) {
  const photos = kinds.filter((k) => k !== 'plan').length;
  const plans = kinds.length - photos;
  const material = [
    photos && `${photos === 1 ? 'a PHOTO' : `${photos} PHOTOS`} (real photographs or existing renders of the property)`,
    plans && `${plans === 1 ? 'a PLAN' : `${plans} PLANS`} (architectural drawings: floor plan, elevation, section or sketch)`,
  ].filter(Boolean).join(' and ');
  const count = shotsFor(kinds.length);
  const style = STYLES[brief.style] || STYLES.classic;
  return `You are the director of high-end real-estate promotional films, the kind top developers in Israel use to launch \
a luxury project: bold, cinematic camera work, perfect light, architecture shown truthfully and at its best. A film that \
makes people stop scrolling, never a slideshow of slow zooms.

A real-estate marketer sends you ${material} of ${KINDS[brief.kind]}${kinds.length > 1 ? `, numbered IMAGE 1 to IMAGE ${kinds.length}` : ''}. You plan a film of exactly ${count} shots, 8 seconds \
each. For every shot an image model first produces a photorealistic opening frame from the supplied images, and an \
image-to-video model then animates that frame with one camera move.
${kinds.length > 1 ? `
You have several images, so use them: build each shot from the image that really shows that building side, room or view, \
and give every image that matters a shot (when there are more images than shots, choose the strongest, most different \
ones). All images show the same property: never mix details between different buildings or rooms. In "sources" list the \
main image first, and at most two more of the same space as extra references.
` : ''}${count > SHOTS ? `
The style below has four beats. With ${count} shots keep its first beat first and its last beat last, and spread the \
middle beats over the extra shots, each one clearly different in subject and camera.
` : ''}
The style of this film, chosen by the marketer: ${style.arc}.
Camera language for this style: ${style.camera}
Every shot must be clearly different from the others in camera position, height and direction of travel. All shots share \
the same light${brief.style === 'timelapse' ? ' at their starting point' : ''}: ${LOOKS[brief.look]}.

Truthfulness is the first rule. This film sells a real property, so never invent what the material does not show: keep \
the exact number of floors, the facade composition, window and balcony layout, materials and colours of a photographed \
building; keep the exact room layout, proportions, doors and windows of a floor plan. You may dress the scene (landscaping, \
sky, light, tasteful furniture, parked cars far away) but not change the architecture.

Writing "still" (the opening frame):
- From a PLAN of a building (elevation / sketch): ask for a photorealistic architectural visualisation of exactly this \
building, naming the camera position (eye-level street view, three-quarter aerial, entrance close-up), lens, materials you \
read from the drawing, surroundings and the light.
- From a floor PLAN of an apartment: each shot is one room or area that exists in the plan. Describe that room as seen by \
a camera standing inside it at eye level: which walls, windows, doors and openings are where (read them from the plan), \
contemporary high-end Israeli interior, real furniture at correct scale, the light. Say explicitly that it must be a \
photograph-like interior view, not a top-down plan.
- From a PHOTO: when the main source is a photo that is already a good frame, prefer the photo itself, cleaned and relit (remove clutter, cranes, wires, signs and \
people; set the light), same camera angle. For other shots you may ask for a new camera position of the same building \
(closer on the entrance, an upper balcony, higher three-quarter aerial) while keeping its design identical.
- Always end with: photorealistic, shot on a full-frame cinema camera, natural colours, no text, no logos, no watermark, \
no people in the foreground. State the frame orientation: ${brief.aspect === '9:16' ? 'vertical 9:16' : 'horizontal 16:9'}.

Writing "motion" (the video prompt): one continuous camera move per shot, in the exact vocabulary of cinematography \
and in the camera language of the chosen style. Say where the camera starts, which way it travels and where it ends, so \
the move covers real distance and the frame at second 8 is visibly different from the frame at second 0. Never cuts. Add \
living details that make it feel real (leaves moving in a breeze, clouds drifting, curtains breathing, reflections \
sliding on glass, water rippling, lights turning on at dusk). State that the building / room geometry stays rigid and \
unchanged, straight verticals, no morphing, no new objects appearing. End with the sound: subtle natural ambience only \
(light breeze, distant birds, soft room tone), no music, no speech.

The opening frame must suit the move: for an aerial shot ask for an aerial opening frame, for a walkthrough an eye-level \
frame with depth ahead of the camera, and leave room in the frame for the direction of travel.

Write "summary", "title" and "why" in natural, simple Israeli Hebrew. Write "still" and "motion" in English. If the \
marketer added a note, follow it. Always finish by calling shot_list.`;
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// שגיאות מ-Anthropic בעברית
export function aiMessage(status, text) {
  const t = String(text || '').toLowerCase();
  if (/credit balance|billing|purchase credits/.test(t)) return 'נגמר הקרדיט בחשבון Anthropic (console.anthropic.com ← Billing).';
  if (status === 401 || status === 403) return 'מפתח ה-API של Anthropic לא תקין. צריך לעדכן אותו בסודות של GitHub.';
  if (status === 429 || status === 529 || status >= 500 || /overloaded|rate.?limit/.test(t)) return 'יש עומס כרגע. נסו שוב בעוד דקה.';
  return 'הבמאי לא הצליח לענות. נסו שוב.';
}

// התשובה של Claude -> { summary, shots } נקי, או null. kinds: סוג כל תמונה שנשלחה לפי הסדר.
// לכל שוט: sources = מספרי התמונות (מ-0) שהוא בנוי מהן, הראשונה היא הראשית. מספר שלא קיים נזרק; בלי כלום – התמונה הראשונה
export function readPlan(input, kinds) {
  const n = kinds.length;
  const fallback = Math.max(0, kinds.findIndex((k) => k !== 'plan'));
  const shots = (Array.isArray(input?.shots) ? input.shots : [])
    .map((s) => {
      const picked = [...new Set((Array.isArray(s?.sources) ? s.sources : []).map((x) => Number(x) - 1).filter((i) => Number.isInteger(i) && i >= 0 && i < n))].slice(0, 3);
      const sources = picked.length ? picked : [fallback];
      let still = clean(s?.still, 2500);
      // שרטוט לעולם לא הופך לסרטון כמו שהוא – חייב פריים פוטוריאליסטי
      if (!still && kinds[sources[0]] === 'plan') still = 'Turn this architectural drawing into a photorealistic architectural visualisation of exactly this design, eye-level view, natural light, no text.';
      return { title: clean(s?.title, 60), why: clean(s?.why, 300), sources, still, motion: clean(s?.motion, 2500) };
    })
    .filter((s) => s.title && s.motion)
    .slice(0, shotsFor(n));
  if (!shots.length) return null;
  return { summary: clean(input?.summary, 500), shots };
}

const imagePart = (im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });

// קריאה אחת ל-Claude. מחזיר את התשובה, או זורק Error בעברית (ו-detail: מה Anthropic ענה)
async function ask(env, body) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // אם המודל מסרב – השרת של Anthropic מנסה לבד מודל אחר
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }),
    });
  } catch {
    throw new Error('אין חיבור לבמאי כרגע. נסו שוב.');
  }
  const raw = await res.text();
  if (!res.ok) {
    const e = new Error(aiMessage(res.status, raw));
    let msg = '';
    try { msg = JSON.parse(raw)?.error?.message || ''; } catch { msg = ''; }
    e.detail = `${res.status} ${MODEL}: ${String(msg || raw).replace(/\s+/g, ' ').slice(0, 300)}`;
    throw e;
  }
  try { return JSON.parse(raw); } catch { throw new Error('הבמאי לא הצליח לענות. נסו שוב.'); }
}

// brief: מ-cleanBrief. images: [{ media_type, data, kind: 'photo' | 'plan' }] (עד 20, לפי הסדר). מחזיר { summary, shots } או זורק Error בעברית
export async function planFilm(env, brief, images) {
  const kinds = images.map((im) => (im.kind === 'plan' ? 'plan' : 'photo'));
  const content = [];
  images.forEach((im, i) => content.push({ type: 'text', text: `IMAGE ${i + 1} (${kinds[i] === 'plan' ? 'PLAN' : 'PHOTO'}):` }, imagePart(im)));
  content.push({ type: 'text', text: `${brief.name ? `Project name: ${brief.name}\n` : ''}${brief.note ? `Note from the marketer (may be in Hebrew): ${brief.note}\n` : ''}Plan the film.` });
  // בלי tool_choice כפוי (המודל לא תומך בזה): אם Claude ענה בטקסט בלי לקרוא לכלי – מבקשים פעם אחת
  const messages = [{ role: 'user', content }];
  let use = null;
  for (let step = 0; step < 2 && !use; step++) {
    const data = await ask(env, { max_tokens: 12000, system: planSystem(brief, kinds), tools: [PLAN_TOOL], messages });
    const got = data.content || [];
    use = got.find((b) => b.type === 'tool_use' && b.name === PLAN_TOOL.name) || null;
    if (use || data.stop_reason !== 'end_turn' || !got.length) break;
    messages.push({ role: 'assistant', content: got }, { role: 'user', content: `Now call ${PLAN_TOOL.name} with your final answer.` });
  }
  const plan = readPlan(use?.input, kinds);
  if (!plan) throw new Error('הבמאי לא הצליח לבנות רשימת שוטים. נסו שוב, או העלו תמונה ברורה יותר.');
  return plan;
}
