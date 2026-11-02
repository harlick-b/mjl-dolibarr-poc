import csv
import hashlib
from datetime import datetime
from io import StringIO
from threading import Event

from sqlalchemy import event, func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_access import admin as admin_fixture
from test_access import headers
from test_planning import ordered_advisory_race, plan, post, references
from test_planning import planning as planning_fixture

from app.auth.models import Audit

planning = planning_fixture
admin = admin_fixture


def export(client):
    return client.post(
        "/api/v1/reports/audit/exports",
        headers=headers(client),
        json={"format": "csv"},
    )


def test_csv_export_is_sanitized_formula_safe_and_transactionally_audited(planning):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(operation_type, name="=2+2"),
            "request_key": "c89cd000-7ae7-45a4-88c7-e39081d41ae8",
        },
    )
    assert created.status_code == 201, created.text

    response = export(planning["validator"])
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith(
        'attachment; filename="historique-audit-'
    )
    assert int(response.headers["content-length"]) == len(response.content)
    decoded = response.content.decode("utf-8-sig")
    records = list(csv.reader(StringIO(decoded), delimiter=";"))
    assert records[0][0] == "Identifiant export"
    assert ["Données capturées UTC", records[3][1]] in records
    header = records.index(
        [
            "Identifiant événement",
            "Date et heure UTC",
            "Action",
            "Résultat",
            "Identifiant acteur",
            "Courriel acteur",
            "Référence activité",
            "Nom activité",
        ]
    )
    body = records[header + 1 :]
    assert any(row[2] == "Activité créée" and row[7] == "'=2+2" for row in body)
    assert "Historique exporté" not in decoded
    assert "request_id" not in decoded and "sha256" not in decoded

    with Session(planning["auth"].engine) as db:
        evidence = db.scalar(
            select(Audit)
            .where(Audit.action == "audit.export")
            .order_by(Audit.id.desc())
        )
        assert evidence and evidence.details
        assert evidence.target == records[0][1]
        assert evidence.details == {
            "format": "csv",
            "row_count": len(body),
            "byte_size": len(response.content),
            "sha256": hashlib.sha256(response.content).hexdigest(),
            "as_of": records[3][1],
        }


def test_csv_export_requires_current_validator_or_admin_and_csrf(planning):
    assert export(planning["validator"]).status_code == 200
    assert export(planning["admin"]).status_code == 200
    assert export(planning["agent"]).status_code == 403
    assert export(planning["supervisor"]).status_code == 403
    assert (
        planning["validator"]
        .post("/api/v1/reports/audit/exports", json={"format": "csv"})
        .status_code
        == 403
    )
    assert (
        planning["validator"]
        .post(
            "/api/v1/reports/audit/exports",
            headers=headers(planning["validator"]),
            json={"format": "xlsx"},
        )
        .status_code
        == 422
    )


def test_csv_export_uses_one_exact_event_snapshot(planning):
    inserted = Event()
    inserted_ids = []

    def add_concurrent_event(_connection, _cursor, statement, *_args):
        if "audit_export_snapshot" not in statement or inserted.is_set():
            return
        inserted.set()
        with planning["auth"].engine.begin() as db:
            inserted_ids.append(
                db.scalar(
                    text(
                        """
                    INSERT INTO auth_audit
                      (occurred_at, action, actor, target, outcome, request_id)
                    VALUES
                      (clock_timestamp(), 'synthetic.after_snapshot', 'system',
                       NULL, 'ok', '00000000-0000-0000-0000-000000009999')
                    RETURNING id
                    """
                    )
                )
            )

    event.listen(planning["auth"].engine, "after_cursor_execute", add_concurrent_event)
    try:
        response = export(planning["validator"])
    finally:
        event.remove(
            planning["auth"].engine, "after_cursor_execute", add_concurrent_event
        )
    assert response.status_code == 200, response.text
    assert inserted.is_set()
    records = list(
        csv.reader(StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )
    header = next(
        i for i, row in enumerate(records) if row and row[0] == "Identifiant événement"
    )
    exported_ids = {row[0] for row in records[header + 1 :]}
    assert str(inserted_ids[0]) not in exported_ids
    with Session(planning["auth"].engine) as db:
        concurrent = db.scalar(
            select(Audit).where(Audit.action == "synthetic.after_snapshot")
        )
        evidence = db.scalar(
            select(Audit)
            .where(Audit.action == "audit.export")
            .order_by(Audit.id.desc())
        )
        assert concurrent and evidence and evidence.details
        assert concurrent.occurred_at > datetime.fromisoformat(
            evidence.details["as_of"]
        )


def test_deactivation_serializes_before_csv_export(planning):
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "validator@example.test"
    )
    with Session(planning["auth"].engine) as db:
        before = db.scalar(
            select(func.count())
            .select_from(Audit)
            .where(Audit.action == "audit.export")
        )
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
        lambda: export(planning["validator"]),
    )
    assert deactivated.status_code == 200
    assert denied.status_code == 401
    assert denied.headers["content-type"].startswith("application/json")
    with Session(planning["auth"].engine) as db:
        after = db.scalar(
            select(func.count())
            .select_from(Audit)
            .where(Audit.action == "audit.export")
        )
        assert after == before


def test_csv_export_fails_closed_when_audit_evidence_cannot_commit(planning):
    def reject(_connection, _cursor, statement, parameters, _context, _many):
        if "INSERT INTO auth_audit" in statement and "audit.export" in str(parameters):
            raise OperationalError(statement, parameters, Exception("synthetic"))

    event.listen(planning["auth"].engine, "before_cursor_execute", reject)
    try:
        response = export(planning["validator"])
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", reject)
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    with Session(planning["auth"].engine) as db:
        assert not db.scalar(select(Audit.id).where(Audit.action == "audit.export"))


def test_csv_export_refuses_more_than_ten_thousand_events(planning):
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                """
                INSERT INTO auth_audit
                  (occurred_at, action, actor, target, outcome, request_id)
                SELECT clock_timestamp(), 'synthetic.limit', 'system', NULL, 'ok',
                       '00000000-0000-0000-0000-' || lpad(i::text, 12, '0')
                FROM generate_series(1, 10001) AS i
                """
            )
        )
    response = export(planning["validator"])
    assert response.status_code == 422
    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(func.count()).select_from(Audit)) > 10_000
        assert not db.scalar(select(Audit.id).where(Audit.action == "audit.export"))


def test_openapi_documents_the_csv_only_export(planning):
    schema = planning["validator"].get("/openapi.json").json()
    operation = schema["paths"]["/api/v1/reports/audit/exports"]["post"]
    request = operation["requestBody"]["content"]["application/json"]["schema"]
    export_input = schema["components"]["schemas"][request["$ref"].split("/")[-1]]
    assert export_input["properties"]["format"]["const"] == "csv"
    assert "text/csv" in operation["responses"]["200"]["content"]
