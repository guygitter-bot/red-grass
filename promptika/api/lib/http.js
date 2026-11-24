// כלים משותפים לתשובות ולשגיאות
export const fail = (status, error) => Object.assign(new Error(error), { status });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

// גוף הבקשה כ-JSON (ריק / שבור -> אובייקט ריק)
export async function readBody(request) {
  try {
    const data = await request.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
