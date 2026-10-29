# ruff: noqa: F401, F811
import json
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import headers
from test_disbursement import collection as disbursement_collection
from test_disbursement import finish_activity
from test_planning import (
    admin,
    login_existing,
    ordered_advisory_race,
    planning,
    post,
    put,
)

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.models import Activity, ActivityContributor, VirementRequest


def approved_disbursement(clients, *, amounts=(100_000, 200_000), allocations=None):
    activity = finish_activity(clients, amounts=amounts, allocations=allocations)
    submitted = post(
        clients["agent"],
        disbursement_collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    prevalidated = post(
        clients["supervisor"],
        f"{disbursement_collection(activity)}/{submitted.json()['id']}/decisions",
        {
            "expected_version": submitted.json()["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        clients["validator"],
        f"{disbursement_collection(activity)}/{submitted.json()['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    return activity, approved.json()


def virement_collection(activity):
    return f"/api/v1/activities/{activity['id']}/virement-requests"


def submit_virement(clients):
    activity, source = approved_disbursement(clients)
    response = post(
        clients["agent"],
        virement_collection(activity),
        {
            "expected_version": source["activity_version"],
            "expected_disbursement_request_id": source["id"],
        },
    )
    assert response.status_code == 201, response.text
    return activity, source, response.json()


def test_agent_submits_locked_amount_and_fresh_reviewers_authorize_virement(planning):
    activity, source = approved_disbursement(planning)
    submitted = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": source["activity_version"],
            "expected_disbursement_request_id": source["id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    request = submitted.json()
    assert request["amount"] == "300000"
    assert request["approved_revision_id"] == source["approved_revision_id"]
    assert request["disbursement_request_id"] == source["id"]
    assert request["state"] == "submitted"

    prevalidated = post(
        planning["supervisor"],
        f"{virement_collection(activity)}/{request['id']}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        planning["validator"],
        f"{virement_collection(activity)}/{request['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    assert approved.json()["state"] == "approved"


def test_virement_preserves_exact_total_with_an_individual_zero_operation(planning):
    activity, source = approved_disbursement(planning, amounts=(0, 200_000))
    submitted = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": source["activity_version"],
            "expected_disbursement_request_id": source["id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["amount"] == "200000"


def test_virement_preserves_a_large_exact_xof_total(planning):
    amounts = (4_000_000_000, 5_000_000_000)
    activity, source = approved_disbursement(
        planning, amounts=amounts, allocations=amounts
    )
    submitted = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": source["activity_version"],
            "expected_disbursement_request_id": source["id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["amount"] == "9000000000"


def test_return_cancellation_and_fresh_request_keep_disbursement_frozen(planning):
    activity, source, request = submit_virement(planning)
    returned = post(
        planning["supervisor"],
        f"{virement_collection(activity)}/{request['id']}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": "return",
            "reason": "Préciser la demande.",
        },
    )
    assert returned.status_code == 201, returned.text
    cancelled = post(
        planning["agent2"],
        f"{virement_collection(activity)}/{request['id']}/cancellation",
        {
            "expected_version": returned.json()["activity_version"],
            "reason": "Soumettre une nouvelle demande.",
        },
    )
    assert cancelled.status_code == 201, cancelled.text
    execution = planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution")
    assert execution.status_code == 200
    assert execution.json()["mutation_unavailable_reason"] == "disbursement_frozen"
    assert execution.json()["virement_context"] == {
        "disbursement_request_id": source["id"],
        "amount": "300000",
        "current_request_id": None,
        "current_state": None,
        "can_submit": True,
        "unavailable_reason": None,
    }
    fresh = post(
        planning["agent2"],
        virement_collection(activity),
        {
            "expected_version": cancelled.json()["activity_version"],
            "expected_disbursement_request_id": source["id"],
        },
    )
    assert fresh.status_code == 201, fresh.text
    stale = post(
        planning["agent"],
        f"{virement_collection(activity)}/{request['id']}/cancellation",
        {
            "expected_version": fresh.json()["activity_version"],
            "reason": "Tentative tardive.",
        },
    )
    assert stale.status_code == 409


def test_submission_rejects_unapproved_source_and_client_amount(planning):
    activity = finish_activity(planning)
    source = post(
        planning["agent"],
        disbursement_collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert source.status_code == 201
    rejected = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": source.json()["activity_version"],
            "expected_disbursement_request_id": source.json()["id"],
        },
    )
    assert rejected.status_code == 409
    injected = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": source.json()["activity_version"],
            "expected_disbursement_request_id": source.json()["id"],
            "amount": "1",
        },
    )
    assert injected.status_code == 422


def test_submission_rejects_valid_foreign_and_cancelled_sources(planning):
    first_activity, first_source = approved_disbursement(planning)
    _second_activity, second_source = approved_disbursement(planning)
    foreign = post(
        planning["agent"],
        virement_collection(first_activity),
        {
            "expected_version": first_source["activity_version"],
            "expected_disbursement_request_id": second_source["id"],
        },
    )
    assert foreign.status_code == 404

    cancelled_activity = finish_activity(planning)
    pending = post(
        planning["agent"],
        disbursement_collection(cancelled_activity),
        {
            "expected_version": cancelled_activity["version"],
            "expected_approved_revision_id": cancelled_activity["approved_revision_id"],
        },
    ).json()
    cancelled = post(
        planning["agent"],
        f"{disbursement_collection(cancelled_activity)}/{pending['id']}/cancellation",
        {
            "expected_version": pending["activity_version"],
            "reason": "Source annulée synthétique.",
        },
    ).json()
    rejected = post(
        planning["agent"],
        virement_collection(cancelled_activity),
        {
            "expected_version": cancelled["activity_version"],
            "expected_disbursement_request_id": pending["id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "disbursement_not_approved"


def test_routes_enforce_roles_csrf_scope_and_cursor_contract(planning):
    activity, source = approved_disbursement(planning)
    path = virement_collection(activity)
    body = {
        "expected_version": source["activity_version"],
        "expected_disbursement_request_id": source["id"],
    }
    assert post(planning["admin"], path, body).status_code == 403
    assert planning["agent"].post(path, json=body).status_code in {401, 403}
    forged = post(
        planning["agent"],
        path,
        {
            **body,
            "expected_disbursement_request_id": (
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            ),
        },
    )
    assert forged.status_code == 404
    assert planning["agent"].get(f"{path}?limit=101").status_code == 422
    schema = planning["agent"].get("/openapi.json").json()
    base = path.replace(activity["id"], "{identifier}")
    responsibilities = {
        base: {"get", "post"},
        base + "/{request_id}": {"get"},
        base + "/{request_id}/decisions": {"post"},
        base + "/{request_id}/cancellation": {"post"},
    }
    for route, methods in responsibilities.items():
        assert methods <= set(schema["paths"][route])
        for method in methods:
            success = schema["paths"][route][method]["responses"][
                "200" if method == "get" else "201"
            ]
            assert success["content"]["application/json"]["schema"]


def test_duplicate_submission_serializes_and_records_one_audit(planning):
    activity, source = approved_disbursement(planning)
    path = virement_collection(activity)
    body = {
        "expected_version": source["activity_version"],
        "expected_disbursement_request_id": source["id"],
    }
    auth = planning["admin"].app.state.auth
    responses = ordered_advisory_race(
        auth,
        lambda: post(planning["agent"], path, body),
        lambda: post(planning["agent2"], path, body),
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    with Session(planning["admin"].app.state.auth.engine) as db:
        assert len(list(db.scalars(select(VirementRequest)))) == 1
        assert (
            len(
                list(db.scalars(select(Audit).where(Audit.action == "virement.submit")))
            )
            == 1
        )


def test_submission_serializes_with_concurrent_activity_version_change(planning):
    activity, source = approved_disbursement(planning)
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    submitted, assignment = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"],
            virement_collection(activity),
            {
                "expected_version": source["activity_version"],
                "expected_disbursement_request_id": source["id"],
            },
        ),
        lambda: put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {
                "expected_version": source["activity_version"],
                "agent_ids": [agent2_id],
            },
        ),
    )
    assert (submitted.status_code, assignment.status_code) == (201, 409)


def test_database_rejects_excluded_reviewer(planning):
    activity, source, request = submit_virement(planning)
    auth = planning["admin"].app.state.auth
    with Session(auth.engine) as db:
        row = db.get(VirementRequest, request["id"])
        assert row
        excluded_id = row.submitter_id
    with pytest.raises(DBAPIError), Session(auth.engine) as db, db.begin():
        db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
        db.execute(
            text(
                "INSERT INTO pta_virement_decision "
                "(id,activity_id,request_id,stage,outcome,actor_id,actor_role,"
                "decided_at,reason,prevalidation_decision_id) VALUES "
                "(:id,:activity,:request,'supervisor','prevalidated',:actor,"
                "'AGENT_VERIFICATEUR',clock_timestamp(),NULL,NULL)"
            ),
            {
                "id": "99999999-9999-4999-8999-999999999999",
                "activity": activity["id"],
                "request": request["id"],
                "actor": excluded_id,
            },
        )
        db.execute(
            text("UPDATE pta_virement_request SET state='prevalidated' WHERE id=:id"),
            {"id": request["id"]},
        )
        db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
    detail = planning["agent"].get(f"{virement_collection(activity)}/{request['id']}")
    assert detail.status_code == 200
    assert detail.json()["state"] == "submitted"


def test_database_rejects_unapproved_source_and_forged_exclusions(planning):
    activity = finish_activity(planning)
    pending = post(
        planning["agent"],
        disbursement_collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    auth = planning["auth"]
    with pytest.raises(DBAPIError, match="Invalid initial virement basis"):
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_virement_request "
                    "(id,context_id,activity_id,disbursement_request_id,"
                    "excluded_reviewer_ids,submitter_id,submitted_at,state) VALUES "
                    "(:id,'MJL',:activity,:source,CAST(:excluded AS jsonb),:actor,"
                    "clock_timestamp(),'submitted')"
                ),
                {
                    "id": str(uuid4()),
                    "activity": activity["id"],
                    "source": pending["id"],
                    "excluded": json.dumps([agent_id]),
                    "actor": agent_id,
                },
            )

    activity, source = approved_disbursement(planning)
    supervisor_id = (
        planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    with Session(auth.engine) as db, db.begin():
        source_row = db.execute(
            text(
                "SELECT snapshot,submitter_id FROM pta_disbursement_request "
                "WHERE id=:id"
            ),
            {"id": source["id"]},
        ).one()
        db.add(
            ActivityContributor(
                context_id="MJL",
                activity_id=activity["id"],
                user_id=supervisor_id,
                contributed_at=auth.now(db),
            )
        )
        forged = set(source_row.snapshot["excluded_reviewer_ids"])
        forged.add(source_row.submitter_id)
        forged.discard(supervisor_id)
        complete = set(source_row.snapshot["excluded_reviewer_ids"])
        complete.add(source_row.submitter_id)
        complete.add(supervisor_id)
    with pytest.raises(DBAPIError, match="Invalid initial virement basis"):
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_virement_request "
                    "(id,context_id,activity_id,disbursement_request_id,"
                    "excluded_reviewer_ids,submitter_id,submitted_at,state) VALUES "
                    "(:id,'MJL',:activity,:source,CAST(:excluded AS jsonb),:actor,"
                    "clock_timestamp(),'prevalidated')"
                ),
                {
                    "id": str(uuid4()),
                    "activity": activity["id"],
                    "source": source["id"],
                    "excluded": json.dumps(sorted(complete)),
                    "actor": source_row.submitter_id,
                },
            )
    with pytest.raises(DBAPIError, match="Invalid initial virement basis"):
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_virement_request "
                    "(id,context_id,activity_id,disbursement_request_id,"
                    "excluded_reviewer_ids,submitter_id,submitted_at,state) VALUES "
                    "(:id,'MJL',:activity,:source,CAST(:excluded AS jsonb),:actor,"
                    "clock_timestamp(),'submitted')"
                ),
                {
                    "id": str(uuid4()),
                    "activity": activity["id"],
                    "source": source["id"],
                    "excluded": json.dumps(sorted(forged)),
                    "actor": source_row.submitter_id,
                },
            )


def test_database_rejects_equal_chronology_and_preserves_final_rows(planning):
    activity, _source, request = submit_virement(planning)
    auth = planning["auth"]
    supervisor_id = (
        planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(auth.engine) as db, db.begin():
            db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
            db.execute(
                text(
                    "INSERT INTO pta_virement_decision "
                    "(id,activity_id,request_id,stage,outcome,actor_id,actor_role,"
                    "decided_at,reason,prevalidation_decision_id) "
                    "SELECT :decision,activity_id,id,'supervisor','prevalidated',"
                    ":actor,"
                    "'AGENT_VERIFICATEUR',submitted_at,NULL,NULL "
                    "FROM pta_virement_request WHERE id=:request"
                ),
                {
                    "decision": str(uuid4()),
                    "actor": supervisor_id,
                    "request": request["id"],
                },
            )
            db.execute(
                text(
                    "UPDATE pta_virement_request SET state='prevalidated' WHERE id=:id"
                ),
                {"id": request["id"]},
            )
            db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    path = f"{virement_collection(activity)}/{request['id']}"
    prevalidated = post(
        planning["supervisor"],
        f"{path}/decisions",
        {"expected_version": request["activity_version"], "decision": "prevalidate"},
    ).json()
    with Session(auth.engine) as db:
        prevalidation_id = db.scalar(
            text(
                "SELECT id FROM pta_virement_decision "
                "WHERE request_id=:id AND stage='supervisor'"
            ),
            {"id": request["id"]},
        )
    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(auth.engine) as db, db.begin():
            db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
            db.execute(
                text(
                    "INSERT INTO pta_virement_decision "
                    "(id,activity_id,request_id,stage,outcome,actor_id,actor_role,"
                    "decided_at,reason,prevalidation_decision_id) VALUES "
                    "(:id,:activity,:request,'validator','approved',:actor,"
                    "'VALIDATEUR_DEFINITIF',clock_timestamp(),NULL,:prevalidation)"
                ),
                {
                    "id": str(uuid4()),
                    "activity": activity["id"],
                    "request": request["id"],
                    "actor": supervisor_id,
                    "prevalidation": prevalidation_id,
                },
            )
            db.execute(
                text("UPDATE pta_virement_request SET state='approved' WHERE id=:id"),
                {"id": request["id"]},
            )
            db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
    approved = post(
        planning["validator"],
        f"{path}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201, approved.text
    with pytest.raises(DBAPIError, match="immutable"):
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text("DELETE FROM pta_virement_decision WHERE request_id=:id"),
                {"id": request["id"]},
            )

    other_activity, _source, cancelled_request = submit_virement(planning)
    cancelled = post(
        planning["agent"],
        f"{virement_collection(other_activity)}/{cancelled_request['id']}/cancellation",
        {
            "expected_version": cancelled_request["activity_version"],
            "reason": "Annulation finale synthétique.",
        },
    )
    assert cancelled.status_code == 201, cancelled.text
    with pytest.raises(DBAPIError, match="immutable"):
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text(
                    "UPDATE pta_virement_request SET cancellation_reason='Altéré' "
                    "WHERE id=:id"
                ),
                {"id": cancelled_request["id"]},
            )


def test_each_mutation_rechecks_the_locked_financial_basis(planning, monkeypatch):
    activity, _source, request = submit_virement(planning)
    import app.planning.virement as virement_module

    original = virement_module.verified_financial_basis

    def stale(db, item):
        total, operations, authors = original(db, item)
        return total + 1, operations, authors

    monkeypatch.setattr(virement_module, "verified_financial_basis", stale)
    path = f"{virement_collection(activity)}/{request['id']}"
    decision = post(
        planning["supervisor"],
        f"{path}/decisions",
        {"expected_version": request["activity_version"], "decision": "prevalidate"},
    )
    assert decision.status_code == 409
    assert decision.json()["code"] == "financial_basis_stale"
    cancellation = post(
        planning["agent"],
        f"{path}/cancellation",
        {
            "expected_version": request["activity_version"],
            "reason": "Base incohérente.",
        },
    )
    assert cancellation.status_code == 409
    assert cancellation.json()["code"] == "financial_basis_stale"
    unchanged = planning["agent"].get(path).json()
    assert unchanged["state"] == "submitted"
    assert unchanged["decisions"] == []


def test_audit_failure_rolls_back_submission_and_activity_version(
    planning, monkeypatch
):
    activity, source = approved_disbursement(planning)
    auth = planning["admin"].app.state.auth

    def fail(*_args, **_kwargs):
        raise ValueError("audit rejected")

    monkeypatch.setattr(auth, "business_audit", fail)
    with pytest.raises(ValueError, match="audit rejected"):
        post(
            planning["agent"],
            virement_collection(activity),
            {
                "expected_version": source["activity_version"],
                "expected_disbursement_request_id": source["id"],
            },
        )
    with Session(auth.engine) as db:
        assert db.scalar(select(VirementRequest)) is None
        assert db.get(Activity, activity["id"]).version == source["activity_version"]


def test_reason_rules_validator_return_and_approved_request_is_final(planning):
    activity, _source, request = submit_virement(planning)
    path = f"{virement_collection(activity)}/{request['id']}"
    missing = post(
        planning["supervisor"],
        f"{path}/decisions",
        {"expected_version": request["activity_version"], "decision": "return"},
    )
    assert missing.status_code == 422
    prevalidated = post(
        planning["supervisor"],
        f"{path}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    returned = post(
        planning["validator"],
        f"{path}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "return",
            "reason": "Reprendre le dossier de virement.",
        },
    )
    assert returned.status_code == 201, returned.text
    assert returned.json()["state"] == "returned"
    cancelled = post(
        planning["agent"],
        f"{path}/cancellation",
        {
            "expected_version": returned.json()["activity_version"],
            "reason": "Préparer une nouvelle demande.",
        },
    ).json()
    fresh = post(
        planning["agent"],
        virement_collection(activity),
        {
            "expected_version": cancelled["activity_version"],
            "expected_disbursement_request_id": request["disbursement_request_id"],
        },
    ).json()
    fresh_path = f"{virement_collection(activity)}/{fresh['id']}"
    prevalidated = post(
        planning["supervisor"],
        f"{fresh_path}/decisions",
        {
            "expected_version": fresh["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved = post(
        planning["validator"],
        f"{fresh_path}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    ).json()
    final_cancel = post(
        planning["agent"],
        f"{fresh_path}/cancellation",
        {
            "expected_version": approved["activity_version"],
            "reason": "Une autorisation finale est immuable.",
        },
    )
    assert final_cancel.status_code == 409


def test_approval_and_cancellation_race_has_one_final_outcome(planning):
    activity, _source, request = submit_virement(planning)
    path = f"{virement_collection(activity)}/{request['id']}"
    prevalidated = post(
        planning["supervisor"],
        f"{path}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved, cancelled = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            f"{path}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        ),
        lambda: post(
            planning["agent2"],
            f"{path}/cancellation",
            {
                "expected_version": prevalidated["activity_version"],
                "reason": "Concurrence synthétique.",
            },
        ),
    )
    assert sorted((approved.status_code, cancelled.status_code)) == [201, 409]


def test_reviewer_deactivation_wins_before_virement_decision(planning):
    activity, _source, request = submit_virement(planning)
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "supervisor@example.test"
    )
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
        lambda: post(
            planning["supervisor"],
            f"{virement_collection(activity)}/{request['id']}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        ),
    )
    assert (deactivated.status_code, denied.status_code) == (200, 401)
    unchanged = planning["validator"].get(
        f"{virement_collection(activity)}/{request['id']}"
    )
    assert unchanged.json()["state"] == "submitted"
    assert unchanged.json()["decisions"] == []


def test_inherited_exclusion_survives_submitter_role_change(planning, auth_env):
    activity, _source, request = submit_virement(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    with Session(planning["auth"].engine) as db, db.begin():
        row = db.get(VirementRequest, request["id"])
        assert row and agent_id in row.excluded_reviewer_ids
        db.get(User, agent_id, with_for_update=True).role = "AGENT_VERIFICATEUR"
    with TestClient(planning["admin"].app, base_url="http://localhost") as reviewer:
        reviewer.app.state.auth.policy = reviewer.app.state.auth.policy.model_copy(
            update={
                "lifecycle_database": reviewer.app.state.auth.engine.url.database,
                "resend_seconds": 0,
            }
        )
        login_existing(reviewer, auth_env.mailbox, "agent@example.test")
        denied = post(
            reviewer,
            f"{virement_collection(activity)}/{request['id']}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        )
    assert denied.status_code == 409
    assert denied.json()["code"] == "decision_ineligible"


def test_audit_failure_rolls_back_decision_and_cancellation(planning, monkeypatch):
    activity, _source, request = submit_virement(planning)
    auth = planning["auth"]
    original = auth.business_audit
    failed_action = ["virement.prevalidated"]

    def fail(db, action, actor, target, business):
        if action == failed_action[0]:
            raise RuntimeError("synthetic virement audit failure")
        return original(db, action, actor, target, business)

    monkeypatch.setattr(auth, "business_audit", fail)
    path = f"{virement_collection(activity)}/{request['id']}"
    with pytest.raises(RuntimeError, match="synthetic virement audit failure"):
        post(
            planning["supervisor"],
            f"{path}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        )
    unchanged = planning["validator"].get(path).json()
    assert unchanged["state"] == "submitted"
    assert unchanged["decisions"] == []
    assert unchanged["activity_version"] == request["activity_version"]
    failed_action[0] = "virement.cancel"
    with pytest.raises(RuntimeError, match="synthetic virement audit failure"):
        post(
            planning["agent"],
            f"{path}/cancellation",
            {
                "expected_version": request["activity_version"],
                "reason": "Échec d’audit synthétique.",
            },
        )
    unchanged = planning["validator"].get(path).json()
    assert unchanged["state"] == "submitted"
    assert unchanged["cancellation"] is None


@pytest.mark.parametrize("mutation", ["submit", "decision", "cancellation"])
@pytest.mark.parametrize("failure", ["constraint", "commit"])
def test_constraint_or_commit_failure_rolls_back_virement_transaction(
    planning, monkeypatch, mutation, failure
):
    activity, source = approved_disbursement(planning)
    request = None
    if mutation != "submit":
        request = post(
            planning["agent"],
            virement_collection(activity),
            {
                "expected_version": source["activity_version"],
                "expected_disbursement_request_id": source["id"],
            },
        ).json()
    action = {
        "submit": "virement.submit",
        "decision": "virement.prevalidated",
        "cancellation": "virement.cancel",
    }[mutation]
    with planning["auth"].engine.connect() as db:
        before = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_virement_request WHERE activity_id=:id),"
                "(SELECT count(*) FROM pta_virement_decision WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit WHERE action LIKE 'virement.%' "
                "AND business->>'activity_id'=:id) FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    original_audit = planning["auth"].business_audit

    def inject_failure(db, recorded_action, *args, **kwargs):
        result = original_audit(db, recorded_action, *args, **kwargs)
        if recorded_action == action:
            if failure == "constraint":
                db.execute(
                    text(
                        "INSERT INTO mjl_ownership_context(id,created_at) "
                        "VALUES ('BAD',clock_timestamp())"
                    )
                )
            else:
                db.info["fail_virement_commit"] = True
        return result

    monkeypatch.setattr(planning["auth"], "business_audit", inject_failure)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_virement_commit", False):
                raise IntegrityError(
                    "synthetic virement commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if mutation == "submit":
        response = post(
            planning["agent"],
            virement_collection(activity),
            {
                "expected_version": source["activity_version"],
                "expected_disbursement_request_id": source["id"],
            },
        )
    elif mutation == "decision":
        response = post(
            planning["supervisor"],
            f"{virement_collection(activity)}/{request['id']}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        )
    else:
        response = post(
            planning["agent"],
            f"{virement_collection(activity)}/{request['id']}/cancellation",
            {
                "expected_version": request["activity_version"],
                "reason": "Échec synthétique.",
            },
        )
    assert response.status_code == 503
    with planning["auth"].engine.connect() as db:
        after = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_virement_request WHERE activity_id=:id),"
                "(SELECT count(*) FROM pta_virement_decision WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit WHERE action LIKE 'virement.%' "
                "AND business->>'activity_id'=:id) FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    assert after == before


def test_virement_evidence_refuses_destructive_downgrade(planning, auth_env):
    submit_virement(planning)
    planning["auth"].engine.dispose()
    with pytest.raises(Exception, match="Refusing destructive PTA-3C downgrade"):
        command.downgrade(Config("alembic.ini"), "0011_pta3b")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0012_pta3c"
            )
    finally:
        engine.dispose()


def test_replaced_virement_guard_function_fails_schema_guard(planning):
    with planning["auth"].engine.connect() as db:
        transaction = db.begin()
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION pta_preserve_virement() RETURNS trigger "
                "LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$"
            )
        )
        with pytest.raises(AuthError, match="eligibility_unverified"):
            planning["auth"].environment_verified(db)
        transaction.rollback()
