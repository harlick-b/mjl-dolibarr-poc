import asyncio
from pathlib import Path

import httpx

from app.main import create_app


def test_staging_http_surface_serves_frontend_routes_without_capturing_api(
    monkeypatch, tmp_path: Path
):
    frontend = tmp_path / "dist"
    assets = frontend / "assets"
    assets.mkdir(parents=True)
    (frontend / "index.html").write_text(
        '<!doctype html><main id="staging-shell">MJL</main>'
    )
    (assets / "app-demo.js").write_text("window.MJL = true")
    monkeypatch.setenv("MJL_AUTH_MODE", "off")
    monkeypatch.setenv("MJL_FRONTEND_DIRECTORY", str(frontend))

    app = create_app(
        "postgresql+psycopg://unused:secret@127.0.0.1:1/absent",
    )
    app.state.auth = None

    async def requests():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            responses = (
                await client.get("/"),
                await client.get("/activities/activity-1"),
                await client.get("/assets/app-demo.js"),
                await client.get("/api/health/live"),
                await client.get("/api/not-a-route"),
                await client.head("/assets/app-demo.js"),
            )
        return responses

    root, deep_link, asset, live, missing_api, asset_head = asyncio.run(requests())

    assert root.status_code == 200
    assert root.headers["cache-control"] == "no-cache"
    assert root.headers["x-frame-options"] == "DENY"
    assert root.headers["referrer-policy"] == "no-referrer"
    assert deep_link.status_code == 200
    assert 'id="staging-shell"' in deep_link.text
    assert asset.text == "window.MJL = true"
    assert asset_head.status_code == 200
    assert asset_head.content == b""
    assert asset_head.headers["content-length"] == asset.headers["content-length"]
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert live.status_code == 200
    assert live.json() == {"status": "ok"}
    assert missing_api.status_code == 404
    assert missing_api.json() == {
        "code": "not_found",
        "message": "Ressource introuvable.",
    }
