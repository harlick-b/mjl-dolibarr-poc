from typing import Annotated

from fastapi import Query


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60,
    cursor: str | None = None,
) -> tuple[int, str | None]:
    return limit, cursor
