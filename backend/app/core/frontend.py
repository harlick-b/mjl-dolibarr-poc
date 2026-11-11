import mimetypes
from pathlib import Path

from starlette.responses import JSONResponse, Response
from starlette.types import Receive, Scope, Send


class FrontendFiles:
    """Read-only ASGI adapter for one immutable Vite build."""

    def __init__(self, directory: Path):
        if not directory.is_dir() or not (directory / "index.html").is_file():
            raise ValueError("Frontend build directory is unavailable")
        self.files = {
            "/" + path.relative_to(directory).as_posix(): path.read_bytes()
            for path in directory.rglob("*")
            if path.is_file()
        }
        self.index = self.files["/index.html"]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        assert scope["type"] == "http"
        method = scope["method"]
        if method not in {"GET", "HEAD"}:
            await JSONResponse(
                {"code": "method_not_allowed", "message": "Méthode refusée."},
                status_code=405,
            )(scope, receive, send)
            return
        path = scope["path"]
        content = self.files.get(path)
        if content is None:
            if path == "/api" or path.startswith("/api/"):
                await JSONResponse(
                    {"code": "not_found", "message": "Ressource introuvable."},
                    status_code=404,
                )(scope, receive, send)
                return
            content = self.index
            path = "/index.html"
        media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        headers = {
            "Content-Length": str(len(content)),
            "Cache-Control": "public, max-age=31536000, immutable"
            if path.startswith("/assets/")
            else "no-cache",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
        }
        await Response(
            content=b"" if method == "HEAD" else content,
            media_type=media_type,
            headers=headers,
        )(scope, receive, send)
