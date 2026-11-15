"""Context rename and ordering."""

from httpx import AsyncClient


async def test_contexts_can_be_renamed_and_reject_a_duplicate_order(
    authed: tuple[object, AsyncClient],
) -> None:
    _app, http = authed
    listed = await http.get("/api/contexts")
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["contexts"]] == [
        "ctx_job1",
        "ctx_job2",
        "ctx_job3",
        "ctx_personal",
    ]
    renamed = await http.patch("/api/contexts/ctx_job1", json={"name": "Acme"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Acme"
    assert renamed.json()["slug"] == "job1"
    duplicate = await http.patch("/api/contexts/ctx_job2", json={"sort_order": 1})
    assert duplicate.status_code == 422
    assert duplicate.json()["code"] == "validation_error"
