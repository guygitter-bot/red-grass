#!/bin/bash
# התקנת ווטסאפ ל-Claude Desktop במק. הרצה:
#   curl -fsSL https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp/install-mac.sh | bash
set -euo pipefail

# גרסה קבועה של הקוד המקורי (נבדקה) – לא מושכים שינויים לא מוכרים
UPSTREAM="https://github.com/lharries/whatsapp-mcp.git"
COMMIT="7d6a06dcdce1f01dfb24f60e1030d5efba9f3b88"
RAW="https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp"
DIR="${WHATSAPP_MCP_DIR:-$HOME/whatsapp-mcp}"
CONFIG="${CLAUDE_CONFIG:-$HOME/Library/Application Support/Claude/claude_desktop_config.json}"

say() { printf '\n==> %s\n' "$1"; }

# כלים: git, uv, go
if ! command -v git >/dev/null; then
  say "חסר git – נפתח חלון התקנה של אפל. אחרי שההתקנה מסתיימת, להריץ שוב את הפקודה."
  xcode-select --install || true
  exit 1
fi
if ! command -v uv >/dev/null; then
  say "מתקין uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v go >/dev/null; then
  if command -v brew >/dev/null; then
    say "מתקין Go"
    brew install go
  else
    say "חסר Go. להוריד ולהתקין מ- https://go.dev/dl/ (הקובץ ל-macOS), ואז להריץ שוב את הפקודה."
    exit 1
  fi
fi

say "מוריד את הקוד אל $DIR"
[ -d "$DIR/.git" ] || git clone -q "$UPSTREAM" "$DIR"
git -C "$DIR" fetch -q origin "$COMMIT" 2>/dev/null || git -C "$DIR" fetch -q origin
git -C "$DIR" checkout -q --force "$COMMIT"

say "מגדיר"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$HERE" ] && [ -f "$HERE/configure.py" ]; then
  cp "$HERE/configure.py" "$DIR/configure.py"
else
  curl -fsSL "$RAW/configure.py" -o "$DIR/configure.py"
fi
uv run --no-project python "$DIR/configure.py" "$DIR" "$CONFIG" "$(command -v uv)"

say "בונה את הגשר (בפעם הראשונה זה לוקח כמה דקות)"
(cd "$DIR/whatsapp-bridge" && go build -o whatsapp-bridge .)

# קובץ הפעלה בלחיצה כפולה
cat > "$DIR/start-whatsapp.command" <<EOF
#!/bin/bash
cd "$DIR/whatsapp-bridge" && ./whatsapp-bridge
EOF
chmod +x "$DIR/start-whatsapp.command"

say "מוכן! עכשיו יופיע קוד QR. בטלפון: ווטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר."
say "אחרי הסריקה: לסגור לגמרי את Claude Desktop ולפתוח מחדש. החלון הזה צריך להישאר פתוח."
[ -n "${WHATSAPP_MCP_NO_START:-}" ] || exec "$DIR/start-whatsapp.command"
