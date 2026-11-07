import json
import logging

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import Audit
from tests.auth.test_auth_security import PASSWORD, accept, login, mail, verify
from tests.auth.test_auth_security import journey as journey_fixture

journey = journey_fixture


@pytest.fixture(autouse=True)
def capture_security(caplog):
    logger = logging.getLogger("mjl.security")
    logger.addHandler(caplog.handler)
    yield
    logger.removeHandler(caplog.handler)


def test_completed_auth_logs_are_separate_and_secret_free(journey, caplog):
    caplog.set_level(logging.INFO, logger="mjl.security")
    assert accept(journey).status_code == 200
    caplog.clear()
    assert login(journey).status_code == 202
    assert not [r for r in caplog.records if r.name == "mjl.security"]
    assert verify(journey, "bad-secret-otp").status_code == 400
    assert verify(journey).status_code == 200
    records = [
        json.loads(r.message) for r in caplog.records if r.name == "mjl.security"
    ]
    assert [r["event"] for r in records] == [
        "authentication_failure",
        "authentication_success",
    ]
    assert records[0]["outcome"] == "otp_invalid"
    assert PASSWORD not in caplog.text and "bad-secret-otp" not in caplog.text
    assert mail(journey[4], "otp")[-1]["value"] not in caplog.text
    with Session(journey[1].engine) as db:
        assert not list(
            db.scalars(
                select(Audit).where(
                    Audit.action.in_(
                        ["login", "otp_prepare", "otp_delivery", "otp_verify"]
                    )
                )
            )
        )


def test_security_log_burst_is_bounded_and_summarized(journey, caplog, monkeypatch):
    from app.auth import security_log

    auth = journey[1]
    caplog.set_level(logging.INFO, logger="mjl.security")
    auth.security_log.limit = 2
    auth.security_log.count = 0
    caplog.clear()
    for _ in range(50):
        with Session(auth.engine) as db, db.begin():
            auth.audit(
                db,
                "access_denied",
                "untrusted\nidentity",
                "secret-token",
                "csrf_invalid",
            )
    records = [
        json.loads(r.message) for r in caplog.records if r.name == "mjl.security"
    ]
    assert len(records) == 2
    assert all("actor_id" not in r for r in records)
    monkeypatch.setattr(
        security_log.time, "monotonic", lambda: auth.security_log.started + 61
    )
    with Session(auth.engine) as db, db.begin():
        auth.audit(db, "access_denied", "anonymous", None, "csrf_invalid")
    records = [
        json.loads(r.message) for r in caplog.records if r.name == "mjl.security"
    ]
    assert records[-2]["event"] == "security_log_suppressed"
    assert records[-2]["suppressed_count"] == 48
    assert len(records) == 4
    assert "secret-token" not in caplog.text and "untrusted" not in caplog.text


def test_security_success_is_not_logged_for_rolled_back_transaction(journey, caplog):
    caplog.set_level(logging.INFO, logger="mjl.security")
    caplog.clear()
    with Session(journey[1].engine) as db:
        with db.begin():
            journey[1].audit(db, "otp_verify", "anonymous", None, "ok")
            db.rollback()
    assert not [r for r in caplog.records if r.name == "mjl.security"]
