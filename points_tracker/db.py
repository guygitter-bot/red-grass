"""The shared food database (data/foods.json) that the app is built with."""

from __future__ import annotations

import json
import re
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "foods.json"


def normalize(text: str) -> str:
    """Same normalization as web/src/lib/foodDb.js."""
    text = re.sub(r"[֑-ׇ]", "", text or "")
    text = re.sub(r"[\"'`׳״]", "", text)
    text = re.sub(r"[()\-–/.,:]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def load(path: Path | None = None) -> dict:
    return json.loads((path or DB_PATH).read_text(encoding="utf-8"))


def save(data: dict, path: Path | None = None) -> None:
    # One food per line keeps git diffs readable.
    lines = [json.dumps(f, ensure_ascii=False) for f in data["foods"]]
    body = ",\n  ".join(lines)
    (path or DB_PATH).write_text(
        f'{{\n "version": {data.get("version", 1)},\n "foods": [\n  {body}\n ]\n}}\n', encoding="utf-8"
    )


def find(data: dict, name: str) -> dict | None:
    """Exact match after normalization, on the name or an alias."""
    key = normalize(name)
    for food in data["foods"]:
        names = [food["name"], *food.get("aliases", [])]
        if any(normalize(n) == key for n in names):
            return food
    return None


def add(data: dict, food: dict) -> bool:
    """Add a food unless one with the same name already exists. Returns True if added."""
    if find(data, food["name"]):
        return False
    data["foods"].append(food)
    return True
