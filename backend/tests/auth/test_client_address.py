from starlette.requests import Request

from app.auth.client_address import client_address


def request(headers: list[tuple[bytes, bytes]]) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/auth/session",
            "headers": headers,
            "client": ("10.0.0.12", 1234),
        }
    )


def test_render_staging_uses_cloudflare_client_address_only_with_edge_evidence():
    through_render = request(
        [
            (b"cf-connecting-ip", b"203.0.113.42"),
            (b"cf-ray", b"8abc123def456789-CDG"),
            (b"x-forwarded-for", b"192.0.2.99"),
        ]
    )
    spoofed_direct = request(
        [
            (b"cf-connecting-ip", b"203.0.113.42"),
            (b"x-forwarded-for", b"192.0.2.99"),
        ]
    )

    assert client_address(through_render, "supabase-staging-v1") == "203.0.113.42"
    assert client_address(spoofed_direct, "supabase-staging-v1") == "10.0.0.12"
    assert client_address(through_render, "local-v1") == "10.0.0.12"
