# ruff: noqa: F401, F811
import csv
import hashlib
from io import StringIO
from uuid import uuid4

import pytest
from sqlalchemy import event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.auth.models import Audit
from app.planning import annual_export as annual_export_module
from tests.auth.test_access import headers
from tests.execution.test_closure import close_path, settled_activity
from tests.execution.test_disbursement import finish_activity
from tests.execution.test_reversement import reversement_path
from tests.execution.test_virement import virement_collection
from tests.planning.test_amendments import approved_activity, open_amendment
from tests.planning.test_planning import (
    admin,
    ordered_advisory_race,
    plan,
    planning,
    post,
    references,
)
from tests.planning.test_transfers import approve_transfer, request_transfer
from tests.planning.test_withdrawals import request_withdrawal


def export(client, pta_id):
    return client.post(
        f"/api/v1/ptas/{pta_id}/exports",
        headers=headers(client),
        json={"format": "csv"},
    )


def records(response):
    return list(
        csv.reader(StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )


def activity_rows(response):
    content = records(response)
    header = next(
        i for i, row in enumerate(content) if row[:1] == ["Identifiant activité"]
    )
    return content, content[header + 1 :]


def approve_zero_and_close(clients):
    activity = finish_activity(clients, amounts=(0, 0))
    submitted = post(
        clients["agent"],
        f"/api/v1/activities/{activity['id']}/zero-spending-declarations",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense engagée.",
        },
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{activity['id']}/zero-spending-declarations/"
        f"{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved = post(
        clients["validator"],
        f"/api/v1/activities/{activity['id']}/zero-spending-declarations/"
        f"{submitted['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    ).json()
    closed = post(
        clients["agent"],
        close_path(activity),
        {"expected_version": approved["activity_version"]},
    )
    assert closed.status_code == 200, closed.text
    return closed.json()


def approve_named(clients, name):
    _partner, operation_type, project = references(clients)
    created = post(
        clients["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type, name=name), "request_key": str(uuid4())},
    ).json()
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    accepted = post(
        clients["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert accepted.status_code == 201, accepted.text
    return clients["agent"].get(f"/api/v1/activities/{created['id']}").json()


def approve_in_project(clients, project_id, operation_type, name):
    created = post(
        clients["agent"],
        f"/api/v1/projects/{project_id}/ptas/2027/activities",
        {**plan(operation_type, name=name), "request_key": str(uuid4())},
    ).json()
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    accepted = post(
        clients["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert accepted.status_code == 201, accepted.text
    return clients["agent"].get(f"/api/v1/activities/{created['id']}").json()


def test_current_pta_csv_exports_metrics_and_definitive_financial_facts(planning):
    activity, request, version = settled_activity(planning)
    corrected = post(
        planning["agent2"],
        reversement_path(activity, request) + "/corrections",
        {
            "expected_version": version,
            "return_date": "2026-10-29",
            "note": "REVERSEMENT-CLOTURE-CORRIGE",
            "reason": "Correction synthétique de la date.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    closed = post(
        planning["agent"],
        close_path(activity),
        {"expected_version": corrected.json()["activity_version"]},
    )
    assert closed.status_code == 200, closed.text

    response = export(planning["validator"], activity["pta_id"])
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith(
        'attachment; filename="pta-'
    )
    assert response.headers["content-disposition"].endswith('.csv"')
    assert int(response.headers["content-length"]) == len(response.content)
    content, rows = activity_rows(response)
    metadata = {row[0]: row[1] for row in content if len(row) == 2}
    assert metadata["Activités clôturées"] == "1"
    assert metadata["Activités approuvées"] == "1"
    assert metadata["Dépenses finales clôturées XOF"] == "200000"
    assert metadata["Allocation approuvée XOF"] == "300000"
    assert metadata["Exécution physique"] == "100 %"
    assert metadata["Exécution financière"] == "66,7 %"
    assert len(rows) == 1
    row = rows[0]
    assert row[0:2] == [activity["id"], activity["reference"]]
    assert row[6:10] == ["Clôturée", "300000", "200000", "200000"]
    assert row[11:14] == ["100000", "100000", "2026-10-29"]
    assert row[14]

    with Session(planning["auth"].engine) as db:
        audit = db.scalar(
            select(Audit).where(Audit.action == "pta.export").order_by(Audit.id.desc())
        )
        assert audit and audit.details
        assert audit.target == metadata["Identifiant export"]
        assert audit.details == {
            "format": "csv",
            "pta_id": activity["pta_id"],
            "row_count": 1,
            "byte_size": len(response.content),
            "sha256": hashlib.sha256(response.content).hexdigest(),
            "as_of": metadata["Données capturées UTC"],
        }


def test_current_pta_csv_uses_latest_external_confirmation(planning):
    activity, request, version = settled_activity(planning, reversement=False)
    corrected = post(
        planning["agent2"],
        f"{virement_collection(activity)}/{request['id']}/confirmation/corrections",
        {
            "expected_version": version,
            "transfer_date": "2026-10-29",
            "note": "VIREMENT-CORRIGE",
            "reason": "Correction synthétique de la date.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    closed = post(
        planning["agent"],
        close_path(activity),
        {"expected_version": corrected.json()["activity_version"]},
    )
    assert closed.status_code == 200, closed.text

    response = export(planning["validator"], activity["pta_id"])
    assert response.status_code == 200, response.text
    row = next(row for row in activity_rows(response)[1] if row[0] == activity["id"])
    assert row[9:12] == ["300000", "2026-10-29", "0"]


def test_current_pta_csv_keeps_approved_baseline_and_current_placement(planning):
    pending, _operation_type = approved_activity(planning)
    open_amendment(planning, pending)
    source = export(planning["agent"], pending["pta_id"])
    assert [row[0] for row in activity_rows(source)[1]] == [pending["id"]]

    transferred, _ = approved_activity(planning)
    transfer = request_transfer(planning, transferred)
    pending_transfer = export(planning["supervisor"], transferred["pta_id"])
    assert transferred["id"] in {row[0] for row in activity_rows(pending_transfer)[1]}
    moved = approve_transfer(planning, transferred, transfer)
    source_after = export(planning["validator"], transferred["pta_id"])
    destination = export(planning["validator"], moved["pta_id"])
    assert transferred["id"] not in {row[0] for row in activity_rows(source_after)[1]}
    assert transferred["id"] in {row[0] for row in activity_rows(destination)[1]}

    withdrawable, _ = approved_activity(planning)
    requested = request_withdrawal(planning, withdrawable)
    pending_withdrawal = export(planning["agent"], withdrawable["pta_id"])
    assert withdrawable["id"] in {
        row[0] for row in activity_rows(pending_withdrawal)[1]
    }
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{withdrawable['id']}/revisions/"
        f"{requested['id']}/decisions",
        {
            "expected_version": requested["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{withdrawable['id']}/revisions/"
        f"{requested['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    after = export(planning["agent"], withdrawable["pta_id"])
    assert withdrawable["id"] not in {row[0] for row in activity_rows(after)[1]}


def test_current_pta_csv_distinguishes_unfinished_and_validated_zero(planning):
    unfinished, _ = approved_activity(planning)
    unfinished_response = export(planning["agent"], unfinished["pta_id"])
    assert unfinished_response.status_code == 200, unfinished_response.text
    unfinished_rows = {row[0]: row for row in activity_rows(unfinished_response)[1]}
    assert unfinished_rows[unfinished["id"]][8:14] == ["", "", "", "", "", ""]

    zero = approve_zero_and_close(planning)
    response = export(planning["agent"], zero["pta_id"])
    assert response.status_code == 200, response.text
    rows = {row[0]: row for row in activity_rows(response)[1]}
    assert rows[zero["id"]][8:14] == ["0", "", "", "0", "", ""]


def test_current_pta_csv_is_formula_safe(planning):
    activity = approve_named(planning, "  =2+2")
    response = export(planning["supervisor"], activity["pta_id"])
    assert response.status_code == 200, response.text
    row = next(row for row in activity_rows(response)[1] if row[0] == activity["id"])
    assert row[2] == "'=2+2"


def test_current_pta_csv_authorization_openapi_and_audit_rollback(planning):
    activity, _ = approved_activity(planning)
    for role in ("agent", "supervisor", "validator"):
        assert export(planning[role], activity["pta_id"]).status_code == 200
    assert export(planning["admin"], activity["pta_id"]).status_code == 403
    assert export(planning["agent"], "not-a-pta").status_code == 404
    assert (
        planning["agent"]
        .post(
            f"/api/v1/ptas/{activity['pta_id']}/exports",
            json={"format": "csv"},
        )
        .status_code
        == 403
    )
    assert (
        planning["agent"]
        .post(
            f"/api/v1/ptas/{activity['pta_id']}/exports",
            headers=headers(planning["agent"]),
            json={"format": "ods"},
        )
        .status_code
        == 422
    )
    wrong_origin = headers(planning["agent"])
    wrong_origin["Origin"] = "https://attacker.invalid"
    rejected_origin = planning["agent"].post(
        f"/api/v1/ptas/{activity['pta_id']}/exports",
        headers=wrong_origin,
        json={"format": "csv"},
    )
    assert rejected_origin.status_code == 403
    assert rejected_origin.headers["content-type"].startswith("application/json")
    schema = planning["validator"].get("/openapi.json").json()
    operation = schema["paths"]["/api/v1/ptas/{identifier}/exports"]["post"]
    assert {item["name"] for item in operation["parameters"]} >= {
        "X-CSRF-Token",
        "Origin",
    }
    assert "text/csv" in operation["responses"]["200"]["content"]
    assert "409" in operation["responses"]

    def reject(_connection, _cursor, statement, parameters, _context, _many):
        if "INSERT INTO auth_audit" in statement and "pta.export" in str(parameters):
            raise OperationalError(statement, parameters, Exception("synthetic"))

    event.listen(planning["auth"].engine, "before_cursor_execute", reject)
    try:
        failed = export(planning["validator"], activity["pta_id"])
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", reject)
    assert failed.status_code == 503
    assert failed.headers["content-type"].startswith("application/json")


def test_current_pta_csv_is_complete_beyond_ui_page_and_refuses_over_bound(
    planning, monkeypatch
):
    first, operation_type = approved_activity(planning)
    second = approve_in_project(
        planning,
        first["project_id"],
        operation_type,
        "Deuxième activité synthétique",
    )
    page = planning["agent"].get(f"/api/v1/ptas/{first['pta_id']}/activities?limit=1")
    assert page.status_code == 200, page.text
    assert page.json()["count"] == 2
    assert len(page.json()["data"]) == 1

    complete = export(planning["agent"], first["pta_id"])
    assert complete.status_code == 200, complete.text
    assert {row[0] for row in activity_rows(complete)[1]} == {
        first["id"],
        second["id"],
    }

    with Session(planning["auth"].engine) as db:
        audits_before = len(
            list(db.scalars(select(Audit.id).where(Audit.action == "pta.export")))
        )
    monkeypatch.setattr(annual_export_module, "MAX_EXPORT_ROWS", 1)
    refused = export(planning["agent"], first["pta_id"])
    assert refused.status_code == 422
    assert refused.headers["content-type"].startswith("application/json")
    with Session(planning["auth"].engine) as db:
        audits_after = len(
            list(db.scalars(select(Audit.id).where(Audit.action == "pta.export")))
        )
    assert audits_after == audits_before


def test_deactivation_serializes_before_current_pta_export(planning):
    activity, _ = approved_activity(planning)
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "validator@example.test"
    )
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
        lambda: export(planning["validator"], activity["pta_id"]),
    )
    assert deactivated.status_code == 200
    assert denied.status_code == 401


@pytest.mark.parametrize("first", ["export", "closure"])
def test_current_pta_export_serializes_with_activity_closure(planning, first):
    activity, _request, version = settled_activity(planning)

    def close():
        return post(
            planning["agent"], close_path(activity), {"expected_version": version}
        )

    def download():
        return export(planning["validator"], activity["pta_id"])

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        download if first == "export" else close,
        close if first == "export" else download,
    )
    exported = first_response if first == "export" else second_response
    closed = second_response if first == "export" else first_response
    assert exported.status_code == 200, exported.text
    assert closed.status_code == 200, closed.text
    row = next(row for row in activity_rows(exported)[1] if row[0] == activity["id"])
    assert row[6] == ("Approuvée" if first == "export" else "Clôturée")
    assert row[8] == ("" if first == "export" else "200000")
