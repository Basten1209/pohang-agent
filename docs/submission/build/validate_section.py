#!/usr/bin/env python3
"""Validate a section JSON file for the RUN2구룡포 proposal renderer.
Usage: python3 validate_section.py sections/sec3.json
Exits non-zero on structural errors. Prints stats (char count, tables, figures)."""
import json, sys, re

ALLOWED_T = {"p", "note", "table", "figure", "code", "box"}
FIG_IDS = {"journey", "architecture", "sysarch", "dataflow"}
FIG_SECTION = {"journey": 2, "architecture": 2, "sysarch": 3, "dataflow": 3}

def plain(s):
    return re.sub(r"\*\*|`", "", s)

def main(path):
    errors, warns = [], []
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        print("ERROR: invalid JSON:", e); sys.exit(1)
    for k in ("number", "title", "blocks"):
        if k not in doc: errors.append(f"missing top-level key '{k}'")
    if errors:
        print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)
    n = doc["number"]
    chars = 0; tchars = 0; ntab = 0; nfig = 0; ncode = 0; figs = []
    prev_level = 0
    for i, b in enumerate(doc["blocks"]):
        t = b.get("t")
        if t not in ALLOWED_T:
            errors.append(f"block {i}: unknown t={t!r}"); continue
        if t == "p":
            lv = b.get("level"); txt = b.get("text", "")
            if lv not in (1, 2, 3, 4): errors.append(f"block {i}: level must be 1-4, got {lv!r}")
            if not txt.strip(): errors.append(f"block {i}: empty text")
            if re.match(r"^\s*[□○\-·•※①②③④⑤]", txt): errors.append(f"block {i}: text must not start with a bullet marker (renderer adds it): {txt[:30]!r}")
            if re.search(r"(다|요)\.\s*$", txt.strip()): warns.append(f"block {i}: ends with 서술형 '~다.' — use 명사형/개조식: {txt[-25:]!r}")
            L = len(plain(txt))
            if lv == 1 and L > 60: warns.append(f"block {i}: level-1 heading long ({L} chars) — keep ≤ 60")
            if L > 150: warns.append(f"block {i}: bullet long ({L} chars) — split it (≤ 150, ideally ≤ 110)")
            if lv is not None and prev_level and lv > prev_level + 1: warns.append(f"block {i}: level jumps from {prev_level} to {lv}")
            if lv: prev_level = lv
            chars += L
        elif t == "note":
            txt = b.get("text", "")
            if not txt.strip(): errors.append(f"block {i}: empty note")
            chars += len(plain(txt))
        elif t == "box":
            txt = b.get("text", "")
            if not txt.strip(): errors.append(f"block {i}: empty box")
            chars += len(plain(txt))
        elif t == "table":
            ntab += 1
            hdr = b.get("header"); rows = b.get("rows"); w = b.get("widths"); cap = b.get("caption", "")
            if not isinstance(hdr, list) or not (2 <= len(hdr) <= 5): errors.append(f"block {i}: table header must have 2-5 columns")
            if not isinstance(rows, list) or not (1 <= len(rows) <= 12): errors.append(f"block {i}: table must have 1-12 rows")
            else:
                for r_i, r in enumerate(rows):
                    if not isinstance(r, list) or len(r) != len(hdr): errors.append(f"block {i}: row {r_i} has {len(r) if isinstance(r,list) else 'n/a'} cells, header has {len(hdr)}")
                    else:
                        for c in r:
                            if not isinstance(c, str): errors.append(f"block {i}: row {r_i} non-string cell")
                            elif len(plain(c)) > 140: warns.append(f"block {i}: row {r_i} cell long ({len(plain(c))} chars) — keep ≤ 140")
                            tchars += len(plain(c)) if isinstance(c, str) else 0
            if not isinstance(w, list) or (hdr and len(w) != len(hdr)) or abs(sum(w) - 100) > 0.5: errors.append(f"block {i}: widths must be a list of percents matching header count and summing to 100")
            if not cap: errors.append(f"block {i}: table needs a caption")
            if re.match(r"^\s*표\s*\d", cap): errors.append(f"block {i}: caption must not start with '표 N' (renderer numbers tables)")
            al = b.get("align")
            if al is not None and (len(al) != len(hdr) or any(a not in ("l", "c") for a in al)): errors.append(f"block {i}: align must be list of 'l'/'c' per column")
        elif t == "figure":
            nfig += 1; fid = b.get("id")
            if fid not in FIG_IDS: errors.append(f"block {i}: figure id must be one of {sorted(FIG_IDS)}")
            elif FIG_SECTION[fid] != n: errors.append(f"block {i}: figure '{fid}' belongs in section {FIG_SECTION[fid]}, not {n}")
            if fid in figs: errors.append(f"block {i}: figure '{fid}' used twice")
            figs.append(fid)
            if not b.get("caption"): errors.append(f"block {i}: figure needs caption")
            if re.match(r"^\s*그림\s*\d", b.get("caption", "")): errors.append(f"block {i}: caption must not start with '그림 N' (renderer numbers figures)")
        elif t == "code":
            ncode += 1; lines = b.get("lines")
            if not isinstance(lines, list) or not lines: errors.append(f"block {i}: code needs non-empty 'lines' list")
            else:
                if len(lines) > 16: warns.append(f"block {i}: code block has {len(lines)} lines — keep ≤ 16")
                for ln in lines:
                    if len(ln) > 78: warns.append(f"block {i}: code line > 78 chars will wrap: {ln[:40]!r}")
    # figure requirements per section
    need = {fid for fid, s in FIG_SECTION.items() if s == n}
    if need and set(figs) != need: errors.append(f"section {n} must contain exactly these figures once each: {sorted(need)} (found {figs})")
    if not need and figs: errors.append(f"section {n} must not contain figures")
    print(f"section {n} '{doc.get('title')}': blocks={len(doc['blocks'])} body chars≈{chars} table chars≈{tchars} tables={ntab} figures={nfig} code={ncode}")
    for w_ in warns: print("WARN:", w_)
    for e in errors: print("ERROR:", e)
    if errors: sys.exit(1)
    print("OK")

if __name__ == "__main__":
    main(sys.argv[1])
