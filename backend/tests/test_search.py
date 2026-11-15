"""FTS5 matching, snippets, and index maintenance."""

from httpx import AsyncClient


async def test_search_finds_transcripts_diacritics_and_ignores_fts_punctuation(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    created = await http.post(
        "/api/items",
        json={
            "type": "meeting",
            "title": "Standup",
            "body_md": "Takeaways only",
            "transcript_raw": "The raw note says reunió and onlytranscriptword.",
        },
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    transcript = await http.get("/api/search", params={"q": "onlytranscriptword"})
    assert transcript.status_code == 200, transcript.text
    hit = transcript.json()["results"][0]
    assert hit["id"] == item_id
    assert hit["snippet_field"] == "transcript_raw"
    assert "«" in hit["snippet"]

    folded = await http.get("/api/search", params={"q": 'reu"nio*'})
    assert folded.status_code == 200, folded.text
    assert folded.json()["results"][0]["id"] == item_id

    short = await http.get("/api/search", params={"q": "a"})
    assert short.status_code == 400
    assert short.json()["code"] == "bad_query"

    punctuation = await http.get("/api/search", params={"q": '*** " " *'})
    assert punctuation.status_code == 400
    assert punctuation.json()["code"] == "bad_query"


async def test_hard_delete_removes_the_item_from_search(authed: tuple[object, AsyncClient]) -> None:
    _app, http = authed
    created = await http.post(
        "/api/items",
        json={"type": "note", "title": "Gone", "body_md": "delete-token-quartz"},
    )
    item_id = created.json()["id"]
    assert (await http.get("/api/search", params={"q": "delete-token-quartz"})).json()["results"]
    assert (await http.delete(f"/api/items/{item_id}")).status_code == 204
    found = await http.get("/api/search", params={"q": "delete-token-quartz"})
    assert found.status_code == 200
    assert found.json()["results"] == []


async def test_fts_rebuild_keeps_search_results(authed: tuple[object, AsyncClient]) -> None:
    app, http = authed
    await http.post("/api/items", json={"type": "note", "title": "Indexed", "body_md": "rebuild-token-maple"})
    before = await http.get("/api/search", params={"q": "rebuild-token-maple"})
    await app.state.db.execute("INSERT INTO fts_search(fts_search) VALUES('rebuild')")
    after = await http.get("/api/search", params={"q": "rebuild-token-maple"})
    assert before.status_code == 200
    assert after.json() == before.json()
    assert after.json()["results"]
