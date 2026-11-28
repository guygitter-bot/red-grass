#!/usr/bin/env bash
# הורדת סרטון מקישור Google Drive (תיקייה או קובץ ששותפו "לכל מי שיש לו את הקישור")
# שימוש: bash fetch.sh <קישור> <תיקיית יעד>
# הערה: docs.googleusercontent.com חסום כאן, לכן מורידים דרך drive.usercontent.google.com
set -euo pipefail
URL="$1"; OUT="${2:-.}"
mkdir -p "$OUT"
ids=()
if [[ "$URL" =~ /folders/([A-Za-z0-9_-]+) ]]; then
  folder="${BASH_REMATCH[1]}"
  page=$(curl -sL "https://drive.google.com/drive/folders/$folder")
  # מזהי הקבצים שבתוך התיקייה
  mapfile -t ids < <(grep -oE '\\x22[0-9A-Za-z_-]{28,44}\\x22' <<<"$page" | sed 's/\\x22//g' | sort -u | grep -v "^$folder$")
elif [[ "$URL" =~ /d/([A-Za-z0-9_-]+) ]] || [[ "$URL" =~ id=([A-Za-z0-9_-]+) ]]; then
  ids=("${BASH_REMATCH[1]}")
else
  echo "ERROR: not a Google Drive link" >&2; exit 1
fi
n=0
for id in "${ids[@]}"; do
  f="$OUT/drive_$id.mp4"
  curl -sL -o "$f" "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" || continue
  if ffprobe -v error -select_streams v -show_entries stream=codec_name -of csv=p=0 "$f" >/dev/null 2>&1 && [ -s "$f" ]; then
    echo "OUTPUT: $f"; n=$((n + 1))
  else
    rm -f "$f"
  fi
done
[ "$n" -gt 0 ] || { echo "ERROR: no video downloaded (is the link shared publicly?)" >&2; exit 1; }
