# "המוח": קריאה אחת ל-Claude שמחזירה תוכנית עריכה (raw_plan.json) לפי plan_schema.json.
# הקלט: תמלול עם זמנים, הדוח, דפי תמונות ממוזערות (contact sheets), קטעי חובה מהטיימליין, סמנים.
# הקוד ב-validate.py אוכף את הכללים (קטעי חובה, אורך, קבוצות כרטיסים) – לא סומכים רק על המודל.
import base64, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = "claude-opus-5-5"


def build_request(job, transcript, sheets, duration, cfg):
    """בונה את הבקשה (בלי לשלוח) – כדי שאפשר יהיה לבדוק אותה או לשלוח מכל שפה אחרת."""
    system = (HERE / "plan_prompt.md").read_text(encoding="utf-8").format(**cfg)
    lines = []
    for s in transcript:
        spk = f" ({s['speaker']})" if s.get("speaker") else ""
        f0 = f" [f0={s['f0']}]" if s.get("f0") else ""
        lines.append(f"[{s['start']:.1f}-{s['end']:.1f}]{spk}{f0} {s['text']}")
    must = [{"start": m["start"], "end": m["end"]} for m in job.get("must_include", [])]
    markers = {k: v for k, v in (job.get("markers") or {}).items() if v is not None}
    labels = "yes" if any(s.get("speaker") for s in transcript) else "no"
    if job.get("rep_speaker"):
        labels += f" (the rep is speaker {job['rep_speaker']}; subtitle only that speaker)"
    rep_only = ("The transcript contains ONLY the sales rep's speech (the shopper was filtered out). Every line is "
                "the rep; infer the shopper's side from the rep's answers, the report and the frames.\n"
                if job.get("transcript_rep_only") else "")
    text = (
        f"Recording length: {duration:.1f} seconds.\n"
        f"Rep: {job.get('rep_name') or 'unknown'}. Speaker labels in transcript: {labels}.\n"
        f"{rep_only}"
        f"Domain vocabulary (for spelling fixes): {', '.join(job.get('vocabulary', []))}\n\n"
        f"Required ranges (must_include, source seconds): {json.dumps(must)}\n"
        f"Markers from the user (source seconds): {json.dumps(markers)}\n\n"
        f"<report>\n{job['report']}\n</report>\n\n"
        f"<transcript>\n" + "\n".join(lines) + "\n</transcript>\n\n"
        "The images below are contact sheets of the recording; each thumbnail is labelled with its source time "
        "in seconds. Use them to find the store entry, the moment they sit at the desk, and the exit.\n"
        "Return the edit plan as JSON."
    )
    content = []
    for p in sheets:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                     "data": base64.b64encode(Path(p).read_bytes()).decode()}})
    content.append({"type": "text", "text": text})
    schema = json.loads((HERE / "plan_schema.json").read_text())
    return dict(
        model=cfg.get("model", MODEL),
        max_tokens=64000,
        system=system,
        messages=[{"role": "user", "content": content}],
        output_config={"effort": cfg.get("effort", "high"), "format": {"type": "json_schema", "schema": schema}},
        # אם המודל מסרב (מסנני בטיחות) – השרת מנסה מודל חלופי בתוך אותה קריאה
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )


def call_claude(request, retries=1):
    """שולח את הבקשה (streaming – תשובה ארוכה) ומחזיר dict. ניסיון נוסף אחד אם ה-JSON לא תקין."""
    import anthropic
    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY מהסביבה
    last = None
    for _ in range(retries + 1):
        with client.beta.messages.stream(**request) as stream:
            msg = stream.get_final_message()
        if msg.stop_reason == "refusal":
            raise RuntimeError(f"Claude declined the request: {getattr(msg, 'stop_details', None)}")
        if msg.stop_reason == "max_tokens":
            last = "response hit max_tokens"
            continue
        text = "".join(b.text for b in msg.content if b.type == "text")
        try:
            return json.loads(text), msg.usage
        except json.JSONDecodeError as e:
            last = f"invalid JSON: {e}"
    raise RuntimeError(f"planner failed: {last}")
