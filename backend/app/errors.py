"""Error body shared by every HTTP failure."""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str,
        *,
        errors: list[dict[str, object]] | None = None,
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code
        self.errors = errors
        super().__init__(detail)


def field_error(field: str, message: str) -> None:  # noqa: RET503 — always raises
    raise AppError(
        422,
        message,
        "validation_error",
        errors=[{"loc": ["body", field], "msg": message}],
    )


def payload_too_large(field: str, limit: int) -> None:
    raise AppError(413, f"{field} exceeds {limit} characters", "payload_too_large")


def _log_server_error(request: Request, status_code: int) -> None:
    if status_code < 500:
        return
    payload = {
        "request_id": getattr(request.state, "request_id", None),
        "method": request.method,
        "path": request.url.path,
        "status": status_code,
    }
    logger.error("%s", json.dumps(payload, separators=(",", ":")))


def _validation_detail(errors: Sequence[object]) -> list[dict[str, object]]:
    rendered: list[dict[str, object]] = []
    for error in errors:
        if not isinstance(error, dict):
            continue
        loc = error.get("loc", ())
        rendered.append({"loc": list(loc) if isinstance(loc, tuple) else loc, "msg": error.get("msg", "")})
    return rendered


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        _log_server_error(request, exc.status_code)
        detail: object = exc.errors if exc.errors is not None else exc.detail
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail, "code": exc.code},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"detail": _validation_detail(exc.errors()), "code": "validation_error"},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        _log_server_error(request, exc.status_code)
        code = "not_found" if exc.status_code == 404 else "http_error"
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(status_code=exc.status_code, content={"detail": detail, "code": code})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        _log_server_error(request, 500)
        logger.error("unhandled %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "internal_error"},
        )
