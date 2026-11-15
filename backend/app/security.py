"""Password hashing, session cookies, origin checks, and login rate limiting."""

from __future__ import annotations

import asyncio
import getpass
import hmac
import logging
import sys
import time
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Request
from starlette.responses import Response

from app.config import Settings

COOKIE_NAME = "notes_session"
COOKIE_MAX_AGE = 2_592_000
SESSION_TTL = timedelta(days=30)
JWT_ALGORITHM = "HS256"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self'; manifest-src 'self'; connect-src 'self'"
    ),
}


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False


def resolve_password_hash(settings: Settings) -> str:
    configured = settings.admin_password_hash.strip()
    if configured:
        return configured
    logging.getLogger("app.security").warning(
        "ADMIN_PASSWORD is set in the environment. Generate ADMIN_PASSWORD_HASH with "
        "`python -m app.security hash-password` and remove ADMIN_PASSWORD."
    )
    return hash_password(settings.admin_password)


def create_access_token(*, username: str, session_version: int, secret: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": username,
        "sv": session_version,
        "iat": now,
        "exp": now + SESSION_TTL,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, secret: str) -> dict[str, object]:
    decoded = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
    return dict(decoded)


def set_session_cookie(response: Response, token: str, *, secure: bool) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, *, secure: bool) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=secure,
        httponly=True,
        samesite="lax",
    )


def apply_security_headers(response: Response) -> None:
    for name, value in SECURITY_HEADERS.items():
        response.headers[name] = value


def origin_is_allowed(method: str, origin: str | None, allowed: list[str]) -> bool:
    if method.upper() not in UNSAFE_METHODS:
        return True
    if origin is None:
        return True
    return origin in allowed


def client_ip(request: Request, *, trust_proxy: bool) -> str:
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",", 1)[0].strip()
            if first:
                return first
    client = request.client
    if client is None or not client.host:
        return "unknown"
    return client.host


class LoginRateLimiter:
    """Five failed logins per 15 minutes per IP. Further failures return 429."""

    def __init__(self, *, limit: int = 5, window_seconds: float = 15 * 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._failures: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def evaluate(self, ip: str, *, credentials_ok: bool) -> str:
        """Return ``ok``, ``invalid``, or ``blocked``.

        A successful login clears the bucket. Once five failures are stored,
        later attempts are blocked until the window expires, including a
        correct password.
        """
        async with self._lock:
            now = time.monotonic()
            active = [
                stamp
                for stamp in self._failures.get(ip, [])
                if now - stamp < self.window_seconds
            ]
            if len(active) >= self.limit:
                self._failures[ip] = active
                return "blocked"
            if not credentials_ok:
                active.append(now)
                self._failures[ip] = active
                return "invalid"
            self._failures.pop(ip, None)
            return "ok"


def secrets_match(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def main(argv: list[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    if args != ["hash-password"]:
        raise SystemExit("usage: python -m app.security hash-password")
    password = getpass.getpass("Password: ")
    if password == "":
        raise SystemExit("Password is empty")
    sys.stdout.write(hash_password(password) + "\n")


if __name__ == "__main__":
    main()
