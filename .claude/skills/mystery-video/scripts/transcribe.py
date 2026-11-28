# תמלול עברית עם Whisper (המשקולות של OpenAI – huggingface חסום כאן)
# שימוש:
#   python3 transcribe.py AUDIO.wav OUT.json                      -> מפה מהירה של כל הסרטון (turbo)
#   python3 transcribe.py AUDIO.wav OUT.json --model large-v3 --ranges ranges.json   -> רק הקטעים שנבחרו, מדויק
# ranges.json: [[start, end], ...] בשניות. הפלט: {"segments":[{start,end,text,words:[{word,start,end}]}]} + OUT.json.txt לקריאה
import argparse, json, time
import torch, whisper

PROMPT = ("שיחה בחנות סמסונג. גלקסי, S26, FE, אולטרה, מתקפל, סנפדרגון, אקסינוס, טרייד-אין, מטען, כבל, "
          "אחריות, מעבדה, יבואן רשמי, יבוא מקביל, סאני 360, KSP, איבורי, בלאק פריידיי, תשלומים, ריבית.")

ap = argparse.ArgumentParser()
ap.add_argument("audio"); ap.add_argument("out")
ap.add_argument("--model", default="turbo"); ap.add_argument("--ranges")
a = ap.parse_args()
torch.set_num_threads(4)
t0 = time.time()
m = whisper.load_model(a.model)
audio = whisper.load_audio(a.audio)
ranges = json.load(open(a.ranges)) if a.ranges else [[0, len(audio) / 16000]]
segs = []
for s0, s1 in ranges:
    r = m.transcribe(audio[int(s0 * 16000):int(s1 * 16000)], language="he", word_timestamps=True,
                     condition_on_previous_text=False, fp16=False, initial_prompt=PROMPT)
    for s in r["segments"]:
        segs.append({"start": s["start"] + s0, "end": s["end"] + s0, "text": s["text"].strip(),
                     "words": [{"word": w["word"].strip(), "start": w["start"] + s0, "end": w["end"] + s0}
                               for w in s.get("words", [])]})
json.dump({"segments": segs}, open(a.out, "w"), ensure_ascii=False, indent=1)
with open(a.out + ".txt", "w") as f:
    for s in segs:
        f.write(f"{s['start']:.1f}-{s['end']:.1f} ({int(s['start']//60)}:{s['start']%60:04.1f}) {s['text']}\n")
print(f"OUTPUT: {a.out}  ({len(segs)} segments, {time.time() - t0:.0f}s)")
