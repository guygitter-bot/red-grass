# מכין את whatsapp-mcp להתקנה: סוגר את הגשר למחשב המקומי בלבד ומוסיף אותו להגדרות של Claude Desktop.
# שימוש: configure.py <whatsapp-mcp dir> <claude_desktop_config.json> <uv path>
import json
import pathlib
import shutil
import sys

repo, cfg_path, uv_path = sys.argv[1:4]
repo = pathlib.Path(repo).resolve()

# במקור הגשר מאזין לכל הרשת (":8080") בלי סיסמה – כל מכשיר באותו Wi-Fi יכול לשלוח הודעות בשמך.
main_go = repo / "whatsapp-bridge" / "main.go"
src = main_go.read_text(encoding="utf-8")
old, new = 'fmt.Sprintf(":%d", port)', 'fmt.Sprintf("127.0.0.1:%d", port)'
if new not in src:
    if old not in src:
        sys.exit("configure: listen address not found in main.go")
    main_go.write_text(src.replace(old, new), encoding="utf-8")

# מוסיפים את "whatsapp" להגדרות בלי למחוק שרתים אחרים שכבר מוגדרים
cfg = pathlib.Path(cfg_path)
cfg.parent.mkdir(parents=True, exist_ok=True)
text = cfg.read_text(encoding="utf-8-sig") if cfg.exists() else ""
data = json.loads(text) if text.strip() else {}
if text.strip():
    shutil.copy(cfg, cfg.with_name(cfg.name + ".backup"))
data.setdefault("mcpServers", {})["whatsapp"] = {
    "command": uv_path,
    "args": ["--directory", str(repo / "whatsapp-mcp-server"), "run", "main.py"],
}
cfg.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("configure: ok ->", cfg)
