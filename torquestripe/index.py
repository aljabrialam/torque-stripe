"""SQLite FTS5 (BM25) index over AD paragraphs. Deterministic, local, sub-millisecond."""
from __future__ import annotations

import re
import sqlite3

from .parse import AD

STOP = set("""a an and are as at be by can do does for from has have how i if in is it its
me my of on or our should that the this to was we what when where which who why will with
you your ad ads apply applies applicable need required were been being did has had there they them those these about into than then so""".split())


def terms(q: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9][a-z0-9\-/]*", q.lower()) if t not in STOP and len(t) > 1]


class Index:
    def __init__(self, ads: list[AD]):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.execute("CREATE VIRTUAL TABLE p USING fts5(ad, pid UNINDEXED, heading, body, tokenize='porter')")
        rows = [(a.number, p.pid, p.heading, p.text) for a in ads for p in a.paragraphs]
        rows += [(a.number, "_subject", "Subject", a.subject or "") for a in ads]
        self.db.executemany("INSERT INTO p VALUES (?,?,?,?)", rows)
        self.db.commit()
        self.vocab = {t for r in rows for t in terms(r[2] + " " + r[3])}

    def search(self, q: str, ad: str | None = None, k: int = 8) -> list[tuple[str, str, float]]:
        ts = [t.replace('"', "") for t in terms(q)]
        if not ts:
            return []
        match = " OR ".join(f'"{t}"' for t in ts)
        sql = "SELECT ad, pid, bm25(p, 0.0, 0.0, 2.0, 1.0) AS s FROM p WHERE p MATCH ?"
        args: list = [match]
        if ad:
            sql += " AND ad = ?"
            args.append(ad)
        sql += " ORDER BY s LIMIT ?"
        args.append(k)
        return [(r[0], r[1], -r[2]) for r in self.db.execute(sql, args)]

    def coverage(self, q: str) -> float:
        """Fraction of query content terms that exist anywhere in the corpus."""
        ts = terms(q)
        if not ts:
            return 0.0
        stems = {v[:5] for v in self.vocab if len(v) >= 5}
        hit = sum(t in self.vocab or (len(t) >= 5 and t[:5] in stems) for t in ts)
        return hit / len(ts)
