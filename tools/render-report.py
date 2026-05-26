#!/usr/bin/env python3
"""Render comparison.json into a self-contained HTML report.

Usage:
    render-report.py <comparison.json> <dated.html> <latest.html>

Reads the comparison array produced by run.sh, groups cases by category, and
emits a self-contained static HTML page with CSS inlined (no external deps).
The dated output is the run-specific artifact; latest.html is a copy of the
same content so a stable URL always points to the most recent run.

Python 3.9+ stdlib only. No third-party dependencies.
"""

from __future__ import annotations

import datetime as _dt
import html as _html
import json
import pathlib
import shutil
import sys
from typing import Any, Iterable

CSS = """
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0 auto;
  max-width: 1100px;
  padding: 2rem 1.5rem 4rem;
  color: #222;
  line-height: 1.45;
}
h1 { margin-bottom: 0.2rem; }
h2 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
.meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
.breadcrumb { font-size: 0.9rem; margin-bottom: 1rem; }
.breadcrumb a { color: #0366d6; text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.summary { background: #f6f8fa; padding: 1rem 1.2rem; border-radius: 6px; margin-bottom: 2rem; }
.summary strong { font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1rem; }
th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; vertical-align: top; }
th { background: #fafbfc; font-weight: 600; }
code { background: #f4f4f4; padding: 0.05rem 0.3rem; border-radius: 3px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.85rem; }
.bool-true { color: #1a7f37; font-weight: 600; }
.bool-false { color: #cf222e; font-weight: 600; }
.bool-null { color: #999; }
.agree-true { background: #e6f4ea; }
.agree-false { background: #fdecea; }
.id { white-space: nowrap; font-family: ui-monospace, monospace; }
.category-meta { color: #666; font-size: 0.85rem; margin-bottom: 0.7rem; }
"""


def _esc(v: Any) -> str:
    if v is None:
        return ""
    return _html.escape(str(v), quote=True)


def _bool_cell(v: Any) -> str:
    if v is True:
        return '<span class="bool-true">true</span>'
    if v is False:
        return '<span class="bool-false">false</span>'
    return '<span class="bool-null">-</span>'


def _group_by_category(rows: Iterable[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        cid = row.get("id", "")
        # Category letter from the id prefix (e.g. "B" from "B.1"), fall back
        # to the "category" slug when the id doesn't follow the convention.
        letter = cid.split(".", 1)[0] if "." in cid else (row.get("category") or "?")
        grouped.setdefault(letter, []).append(row)
    return dict(sorted(grouped.items()))


def _summary(rows: list[dict]) -> dict[str, int]:
    total = len(rows)
    agree = sum(1 for r in rows if r.get("agree") is True)
    candidate_match = sum(1 for r in rows if r.get("candidate") == r.get("expected"))
    icdapi_match = sum(1 for r in rows if r.get("icdapi") == r.get("expected"))
    return {
        "total": total,
        "agree": agree,
        "candidate_match": candidate_match,
        "icdapi_match": icdapi_match,
    }


def render(rows: list[dict]) -> str:
    stamp = _dt.datetime.now(tz=_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    grouped = _group_by_category(rows)
    summary = _summary(rows)

    parts: list[str] = []
    parts.append("<!doctype html>")
    parts.append('<html lang="en"><head>')
    parts.append('<meta charset="utf-8">')
    parts.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    parts.append("<title>ICD-11 Postcoord Conformance Report</title>")
    parts.append(f"<style>{CSS}</style>")
    parts.append("</head><body>")
    parts.append(
        '<div class="breadcrumb"><a href="../index.html">&laquo; ICD-11 Postcoord Conformance Suite</a></div>'
    )
    parts.append("<h1>ICD-11 Postcoordination Conformance Report</h1>")
    parts.append(f'<div class="meta">Generated {_esc(stamp)} &middot; {summary["total"]} cases</div>')
    parts.append('<div class="summary">')
    parts.append(
        f'<strong>{summary["agree"]} / {summary["total"]}</strong> cross-backend agreement '
        f'&middot; <strong>{summary["candidate_match"]} / {summary["total"]}</strong> candidate matches suite '
        f'&middot; <strong>{summary["icdapi_match"]} / {summary["total"]}</strong> ICD-API matches suite.'
    )
    parts.append("</div>")

    for cat, cases in grouped.items():
        parts.append(f"<h2>Category {_esc(cat)}</h2>")
        if cases:
            slug = cases[0].get("category") or ""
            parts.append(f'<div class="category-meta">Slug: <code>{_esc(slug)}</code></div>')
        parts.append("<table>")
        parts.append(
            "<thead><tr>"
            "<th>id</th><th>expression</th><th>expected</th>"
            "<th>candidate</th><th>icdapi</th><th>agree</th>"
            "<th>refguide</th><th>rationale</th>"
            "</tr></thead><tbody>"
        )
        for row in cases:
            agree = row.get("agree")
            row_class = "agree-true" if agree is True else ("agree-false" if agree is False else "")
            parts.append(f'<tr class="{row_class}">')
            parts.append(f'<td class="id">{_esc(row.get("id"))}</td>')
            parts.append(f"<td><code>{_esc(row.get('expression'))}</code></td>")
            parts.append(f"<td>{_bool_cell(row.get('expected'))}</td>")
            parts.append(f"<td>{_bool_cell(row.get('candidate'))}</td>")
            parts.append(f"<td>{_bool_cell(row.get('icdapi'))}</td>")
            parts.append(f"<td>{_bool_cell(agree)}</td>")
            parts.append(f"<td>{_esc(row.get('refguide'))}</td>")
            parts.append(f"<td>{_esc(row.get('rationale'))}</td>")
            parts.append("</tr>")
        parts.append("</tbody></table>")

    parts.append("</body></html>")
    return "\n".join(parts)


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    src = pathlib.Path(argv[1])
    dated = pathlib.Path(argv[2])
    latest = pathlib.Path(argv[3])

    if not src.is_file():
        print(f"comparison.json not found: {src}", file=sys.stderr)
        return 1

    try:
        rows = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"comparison.json is not valid JSON: {e}", file=sys.stderr)
        return 1

    if not isinstance(rows, list):
        print("comparison.json must be a JSON array at the top level", file=sys.stderr)
        return 1

    html = render(rows)

    dated.parent.mkdir(parents=True, exist_ok=True)
    dated.write_text(html, encoding="utf-8")
    # Copy, not symlink — CI runners and some Pages setups don't follow symlinks.
    shutil.copyfile(dated, latest)
    print(f"Wrote {dated} ({len(rows)} cases)")
    print(f"Wrote {latest} (copy of {dated.name})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
