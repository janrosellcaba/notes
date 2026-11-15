"""FTS5 query builder and search."""

from __future__ import annotations

import sqlite3
from typing import Any

from app.db import Database
from app.errors import AppError
from app.schemas.item import ProjectRef
from app.schemas.project import ContextRef
from app.schemas.search import SearchHit
from app.services.contexts import require_context

_PUNCT = str.maketrans("", "", "\"*:()^")
_MARK = "«"


def build_match(query: str) -> str:
    if not query.strip():
        raise AppError(400, "Query is empty", "bad_query")
    tokens: list[str] = []
    for raw in query.split():
        cleaned = raw.translate(_PUNCT).strip()
        if len(cleaned) < 2:
            continue
        tokens.append(cleaned)
    if not tokens:
        raise AppError(400, "Query is empty", "bad_query")
    return " AND ".join(f'"{token}"*' for token in tokens)


def _project(row: Any) -> ProjectRef | None:
    if row["proj_id"] is None:
        return None
    return ProjectRef(
        id=row["proj_id"],
        name=row["proj_name"],
        color=row["proj_color"] or row["ctx_color"],
        context=ContextRef(
            id=row["ctx_id"],
            slug=row["ctx_slug"],
            name=row["ctx_name"],
            color=row["ctx_color"],
        ),
    )


async def search_items(
    db: Database,
    *,
    query: str,
    context_id: str | None,
    limit: int,
) -> list[SearchHit]:
    if context_id is not None:
        await require_context(db, context_id)
    match = build_match(query)
    clauses = ["fts_search MATCH ?", "i.archived_at IS NULL"]
    params: list[Any] = [match]
    if context_id is not None:
        clauses.append("(i.project_id IS NULL OR c.id = ?)")
        params.append(context_id)
    params.append(limit)
    try:
        rows = await db.fetchall(
            f"""
            SELECT i.id, i.type, i.title, i.updated_at,
                   snippet(fts_search, 1, '«', '»', '…', 18) AS body_snip,
                   snippet(fts_search, 2, '«', '»', '…', 18) AS transcript_snip,
                   p.id AS proj_id, p.name AS proj_name, p.color AS proj_color,
                   c.id AS ctx_id, c.slug AS ctx_slug, c.name AS ctx_name, c.color AS ctx_color
            FROM fts_search
            JOIN items i ON i.rowid = fts_search.rowid
            LEFT JOIN projects p ON p.id = i.project_id
            LEFT JOIN contexts c ON c.id = p.context_id
            WHERE {' AND '.join(clauses)}
            ORDER BY bm25(fts_search)
            LIMIT ?
            """,
            params,
        )
    except sqlite3.OperationalError as exc:
        raise AppError(400, "Query is empty", "bad_query") from exc
    hits: list[SearchHit] = []
    for row in rows:
        body = row["body_snip"] or ""
        transcript = row["transcript_snip"] or ""
        if _MARK in body:
            snippet, field = body, "body_md"
        else:
            snippet, field = transcript, "transcript_raw"
        hits.append(
            SearchHit(
                id=row["id"],
                type=row["type"],
                title=row["title"],
                snippet=snippet,
                snippet_field=field,
                project=_project(row),
                updated_at=row["updated_at"],
            )
        )
    return hits
