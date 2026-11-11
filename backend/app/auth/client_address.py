import re
from ipaddress import ip_address

from fastapi import Request

RENDER_STAGING_FIXTURE = "supabase-staging-v1"
CF_RAY = re.compile(r"[0-9a-f]{16,32}-[A-Za-z]{3}")


def client_address(request: Request, fixture: str) -> str:
    socket_address = request.client.host if request.client else "unknown"
    connecting_ip = request.headers.get("cf-connecting-ip")
    ray = request.headers.get("cf-ray", "")
    if fixture != RENDER_STAGING_FIXTURE or not CF_RAY.fullmatch(ray):
        return socket_address
    try:
        return str(ip_address(connecting_ip or ""))
    except ValueError:
        return socket_address
