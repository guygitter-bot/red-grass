# אוכף את הכללים על תוכנית העריכה בקוד (לא סומכים רק על המודל) ובונה render_plan.json.
# - כל קטע חובה (must_include) נכנס במלואו; חפיפות מתאחדות.
# - אורך כולל בטווח; ארוך מדי -> מוציאים קטעים לפי עדיפות (3 ואז 2), לעולם לא קטע חובה.
# - כתוביות רק בתוך קטעים; אם יש תוויות דוברים – רק של הנציג/ה.
# - בדיוק שתי קבוצות של 3–4 כרטיסים, בתוך קטע, עם 20 שנ' לפני סוף הקטע.
# מחזיר (render_plan, warnings).

MERGE_GAP = 3.0


def _merge(ranges):
    out = []
    for r in sorted(ranges, key=lambda r: r["start"]):
        if out and r["start"] <= out[-1]["end"] + MERGE_GAP:
            out[-1]["end"] = max(out[-1]["end"], r["end"])
            out[-1]["priority"] = min(out[-1]["priority"], r["priority"])
            out[-1]["must"] = out[-1]["must"] or r["must"]
        else:
            out.append(dict(r))
    return out


def film_length(clips, cfg):
    n = len(clips) + 2  # + פתיח + סיכום
    return cfg["intro_seconds"] + cfg["outro_seconds"] + sum(c["end"] - c["start"] for c in clips) - cfg["fade"] * (n - 1)


def build(raw, job, transcript, duration, cfg):
    warnings = []
    clamp = lambda t: max(0.0, min(duration, float(t)))
    clips = [{"start": clamp(c["start"]), "end": clamp(c["end"]), "priority": c.get("priority", 2), "must": False}
             for c in raw.get("clips", []) if clamp(c["end"]) - clamp(c["start"]) >= 1.0]
    # קטעי חובה מהטיימליין – תמיד נכנסים, עם מרווח קטן לפני ואחרי
    for m in job.get("must_include", []):
        s, e = clamp(m["start"]), clamp(m["end"])
        if e > s:
            clips.append({"start": clamp(s - 0.3), "end": clamp(e + 0.3), "priority": 0, "must": True})
    # כניסה ויציאה – חייבות להיות בסרט (לפי הסמנים של המשתמש או של המודל)
    mk = {**(raw.get("markers") or {}), **{k: v for k, v in (job.get("markers") or {}).items() if v is not None}}
    covered = lambda t: any(c["start"] <= t <= c["end"] for c in clips)
    if mk.get("entry_start", -1) >= 0 and not covered(mk["entry_start"]):
        clips.append({"start": clamp(mk["entry_start"]), "end": clamp(mk["entry_start"] + 20), "priority": 1, "must": False})
    if mk.get("exit_end", -1) >= 0 and not covered(mk["exit_end"]):
        clips.append({"start": clamp(mk["exit_end"] - 15), "end": clamp(mk["exit_end"]), "priority": 1, "must": False})
    if mk.get("entry_start", -1) < 0 or mk.get("exit_end", -1) < 0:
        warnings.append("store entry or exit not found – add markers on the timeline")
    clips = _merge(clips)

    # אורך: מוציאים קטעים בעדיפות הנמוכה ביותר (הקצרים קודם) עד שנכנסים בטווח
    for prio in (3, 2):
        while film_length(clips, cfg) > cfg["target_max"]:
            cand = [c for c in clips if c["priority"] == prio and not c["must"]]
            if not cand:
                break
            clips.remove(min(cand, key=lambda c: c["end"] - c["start"]))
    total = film_length(clips, cfg)
    if total > cfg["target_max"]:
        must_len = sum(c["end"] - c["start"] for c in clips if c["must"])
        warnings.append(f"film is {total:.0f}s, above {cfg['target_max']}s"
                        + (f"; required ranges alone are {must_len:.0f}s" if must_len else ""))
    if total < cfg["target_min"]:
        warnings.append(f"film is {total:.0f}s, below {cfg['target_min']}s")

    # כתוביות: בתוך קטע, ולפי תוויות דוברים כשיש
    rep = job.get("rep_speaker")
    rep_only = bool(job.get("transcript_rep_only"))
    def speaker_at(s, e):
        spk = {t.get("speaker") for t in transcript if t.get("speaker") and t["start"] < e and t["end"] > s}
        return spk
    for c in clips:
        c["subs"] = []
    dropped = 0
    for sb in raw.get("subtitles", []):
        s, e, text = clamp(sb["start"]), clamp(sb["end"]), sb["text"].strip()
        host = next((c for c in clips if c["start"] <= s < c["end"]), None)
        if not text or not host or e <= s:
            dropped += 1; continue
        if rep and (spk := speaker_at(s, e)) and rep not in spk:
            dropped += 1; continue
        # תמלול של הנציג/ה בלבד: כתובית שלא נופלת על אף משפט בתמלול – כנראה של הדוגם
        if rep_only and not any(t["start"] < e and t["end"] > s for t in transcript):
            dropped += 1; continue
        host["subs"].append({"start": s, "end": min(e, host["end"]), "text": text})
    if dropped:
        warnings.append(f"{dropped} subtitles dropped (outside clips or not the rep)")

    # כרטיסים: בדיוק שתי קבוצות של 3–4
    groups = sorted(raw.get("card_groups", []), key=lambda g: g["at"])
    if len(groups) != 2:
        warnings.append(f"planner returned {len(groups)} card groups; using {min(2, len(groups))}")
        groups = groups[:1] + groups[-1:] if len(groups) > 2 else groups
    for c in clips:
        c["cards"] = []
    for g in groups:
        cards = [x for x in g["cards"] if x.get("text", "").strip()][:4]
        if len(cards) < 3:
            warnings.append(f"card group at {g['at']:.0f}s has only {len(cards)} cards")
        if not cards:
            continue
        at = clamp(g["at"])
        host = next((c for c in clips if c["start"] <= at < c["end"]), None)
        if not host:  # הכי קרוב שיש בו מקום
            host = min(clips, key=lambda c: min(abs(c["start"] - at), abs(c["end"] - at)))
            warnings.append(f"card group at {at:.0f}s moved into the nearest clip")
        at = max(host["start"] + 0.5, min(at, host["end"] - 20))
        end = min(host["end"] - 0.4, at + 22)
        for i, x in enumerate(cards):
            host["cards"].append({"t": round(at + 0.35 * i, 2), "end": round(end, 2), "kind": x["kind"], "text": x["text"].strip()})

    plan = [{"start": round(c["start"], 2), "end": round(c["end"], 2), "subs": c["subs"], "cards": c["cards"]}
            for c in clips]
    return plan, warnings
