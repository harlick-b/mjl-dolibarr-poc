# ruff: noqa: F401, F811
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.auth.models import Audit
from app.planning.models import (
    Activity,
    ActivityContributor,
    DisbursementRequest,
    ReversementDeclaration,
    VirementConfirmation,
    VirementRequest,
    ZeroSpendingDecision,
    ZeroSpendingDeclaration,
)
from tests.execution.test_disbursement import finish_activity
from tests.execution.test_execution import execution_path
from tests.planning.test_planning import (
    admin,
    ordered_advisory_race,
    patch,
    planning,
    post,
)
from tests.reports.test_fiche import fiche_path, pdf_text


def collection(activity):
    return f"/api/v1/activities/{activity['id']}/zero-spending-declarations"


def test_agent_declares_zero_distinct_reviewers_approve_and_agent_closes(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Les opérations ont été réalisées sans dépense.",
        },
    )
    assert submitted.status_code == 201, submitted.text
    declaration = submitted.json()
    assert "snapshot" not in declaration
    assert submitted.headers["location"].endswith(
        f"/activities/{activity['id']}/zero-spending-declarations/{declaration['id']}"
    )
    assert declaration["state"] == "submitted"
    planning_detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    )
    assert "open_amendment" not in planning_detail["allowed_actions"]

    prevalidated = post(
        planning["supervisor"],
        f"{collection(activity)}/{declaration['id']}/decisions",
        {
            "expected_version": declaration["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        planning["validator"],
        f"{collection(activity)}/{declaration['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    assert approved.json()["state"] == "approved"

    detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert detail["closure_blockers"] == []
    assert "close" in detail["allowed_actions"]
    closed = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/closure",
        {"expected_version": approved.json()["activity_version"]},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["state"] == "closed"

    fiche = planning["agent"].get(fiche_path(activity))
    assert fiche.status_code == 200, fiche.text
    content = pdf_text(fiche)
    assert "Déclaration sans dépense" in content
    assert "Dépense nulle validée" in content
    history = planning["validator"].get("/api/v1/audit-events?limit=100").json()
    projected = {row["action"]: row["label"] for row in history["data"]}
    assert projected["zero_spending.submit"] == "Déclaration sans dépense soumise"
    assert projected["zero_spending.prevalidated"] == "Dépense nulle prévalidée"
    assert projected["zero_spending.approved"] == "Dépense nulle validée"

    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(func.count()).select_from(ZeroSpendingDeclaration)) == 1
        assert db.scalar(select(func.count()).select_from(DisbursementRequest)) == 0
        assert db.scalar(select(func.count()).select_from(VirementRequest)) == 0
        assert db.scalar(select(func.count()).select_from(VirementConfirmation)) == 0
        assert db.scalar(select(func.count()).select_from(ReversementDeclaration)) == 0
        actions = set(
            db.scalars(select(Audit.action).where(Audit.target == declaration["id"]))
        )
        assert actions == {
            "zero_spending.submit",
            "zero_spending.prevalidated",
            "zero_spending.approved",
        }


def test_zero_declaration_rejects_nonzero_and_stale_inputs(planning):
    positive = finish_activity(planning)
    denied = post(
        planning["agent"],
        collection(positive),
        {
            "expected_version": positive["version"],
            "expected_approved_revision_id": positive["approved_revision_id"],
            "reason": "Déclaration incorrecte.",
        },
    )
    assert denied.status_code == 409
    assert denied.json()["code"] == "zero_spending_ineligible"

    zero = finish_activity(planning, amounts=(0, 0))
    stale = post(
        planning["agent"],
        collection(zero),
        {
            "expected_version": zero["version"] - 1,
            "expected_approved_revision_id": zero["approved_revision_id"],
            "reason": "Version périmée.",
        },
    )
    assert stale.status_code == 409
    assert planning["validator"].get(collection(zero)).json()["count"] == 0

    stale_revision = post(
        planning["agent"],
        collection(zero),
        {
            "expected_version": zero["version"],
            "expected_approved_revision_id": "11111111-1111-4111-8111-111111111111",
            "reason": "Révision périmée.",
        },
    )
    assert stale_revision.status_code == 409
    assert stale_revision.json()["code"] == "approved_revision_stale"
    submitted = post(
        planning["agent"],
        collection(zero),
        {
            "expected_version": zero["version"],
            "expected_approved_revision_id": zero["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    )
    assert submitted.status_code == 201
    replay = post(
        planning["agent"],
        collection(zero),
        {
            "expected_version": submitted.json()["activity_version"],
            "expected_approved_revision_id": zero["approved_revision_id"],
            "reason": "Nouvelle tentative.",
        },
    )
    assert replay.status_code == 409
    assert replay.json()["code"] == "zero_spending_exists"


def test_return_releases_correction_and_preserves_history(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()
    operation = activity["operations"][0]
    frozen = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": submitted["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "1",
            "execution_completed": True,
            "execution_observation": "Correction.",
            "correction_reason": "Montant retrouvé.",
        },
    )
    assert frozen.status_code == 409
    assert frozen.json()["code"] == "zero_spending_frozen"

    returned = post(
        planning["supervisor"],
        f"{collection(activity)}/{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "return",
            "reason": "Vérifier le justificatif.",
        },
    )
    assert returned.status_code == 201, returned.text
    assert (
        "open_amendment"
        in planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}")
        .json()["allowed_actions"]
    )
    corrected = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": returned.json()["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "1",
            "execution_completed": True,
            "execution_observation": "Correction.",
            "correction_reason": "Montant retrouvé.",
        },
    )
    assert corrected.status_code == 200, corrected.text
    history = planning["validator"].get(collection(activity)).json()
    assert history["count"] == 1
    assert history["data"][0]["state"] == "returned"


def test_validator_return_commits_and_allows_fresh_declaration(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"{collection(activity)}/{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    returned = post(
        planning["validator"],
        f"{collection(activity)}/{submitted['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "return",
            "reason": "Préciser les moyens propres utilisés.",
        },
    )
    assert returned.status_code == 201, returned.text
    assert returned.json()["state"] == "returned"
    operation = activity["operations"][0]
    corrected = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": returned.json()["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "0",
            "execution_completed": True,
            "execution_observation": "Moyens propres documentés.",
            "correction_reason": "Précision demandée par le Validateur.",
        },
    )
    assert corrected.status_code == 200, corrected.text
    fresh = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": corrected.json()["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense, moyens propres utilisés.",
        },
    )
    assert fresh.status_code == 201, fresh.text
    assert fresh.json()["id"] != submitted["id"]
    assert planning["validator"].get(collection(activity)).json()["count"] == 2


def test_review_is_role_guarded(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()
    path = f"{collection(activity)}/{submitted['id']}/decisions"
    assert (
        post(
            planning["admin"],
            path,
            {
                "expected_version": submitted["activity_version"],
                "decision": "prevalidate",
            },
        ).status_code
        == 403
    )
    excluded = post(
        planning["agent"],
        path,
        {"expected_version": submitted["activity_version"], "decision": "prevalidate"},
    )
    assert excluded.status_code == 403


def test_contributor_supervisor_is_excluded_from_review(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    supervisor_id = (
        planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    with Session(planning["auth"].engine) as db, db.begin():
        db.add(
            ActivityContributor(
                context_id="MJL",
                activity_id=activity["id"],
                user_id=supervisor_id,
                contributed_at=planning["auth"].now(db),
            )
        )
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()
    visible = planning["supervisor"].get(collection(activity)).json()["data"][0]
    assert visible["allowed_actions"] == ["read"]
    denied = post(
        planning["supervisor"],
        f"{collection(activity)}/{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert denied.status_code == 409
    assert denied.json()["code"] == "decision_ineligible"


def test_unexpected_zero_spending_schema_fails_closed(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "ALTER TABLE pta_zero_spending_declaration "
                "ADD COLUMN unexpected integer"
            )
        )
    response = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "eligibility_unverified"


def test_zero_spending_migration_round_trip_when_empty(auth_env):
    config = Config("alembic.ini")
    command.downgrade(config, "0017_pta6a")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0017_pta6a"
        )
        assert (
            db.scalar(text("SELECT to_regclass('pta_zero_spending_declaration')"))
            is None
        )
        function = db.scalar(
            text(
                "SELECT pg_get_functiondef("
                "'pta_validate_activity_closure()'::regprocedure)"
            )
        )
        assert "spent<=0" in function
    command.upgrade(config, "head")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0027_pta_metadata"
        )


def test_database_rejects_duplicated_operation_snapshot(planning):
    activity = finish_activity(planning, amounts=(0, 0))
    operation = activity["operations"][0]
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    duplicate = {
        "id": operation["id"],
        "approved_allocation": operation["approved_allocation"],
        "actual_spent": "0",
        "execution_completed": True,
    }
    with pytest.raises(DBAPIError, match="Invalid initial zero-spending basis"):
        with Session(planning["auth"].engine) as db, db.begin():
            db.add(
                ZeroSpendingDeclaration(
                    context_id="MJL",
                    activity_id=activity["id"],
                    approved_revision_id=activity["approved_revision_id"],
                    snapshot={
                        "total": "0",
                        "operations": [duplicate, duplicate],
                        "excluded_reviewer_ids": [agent_id],
                    },
                    reason="Snapshot volontairement invalide.",
                    submitter_id=agent_id,
                    submitted_at=planning["auth"].now(db),
                    state="submitted",
                )
            )
            db.flush()
    assert planning["validator"].get(collection(activity)).json()["count"] == 0


@pytest.mark.parametrize(
    ("field", "mode"),
    [("actual_spent", "missing"), ("execution_completed", "null")],
)
def test_database_rejects_missing_explicit_zero_facts(planning, field, mode):
    activity = finish_activity(planning, amounts=(0, 0))
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    facts = [
        {
            "id": operation["id"],
            "approved_allocation": operation["approved_allocation"],
            "actual_spent": "0",
            "execution_completed": True,
        }
        for operation in activity["operations"]
    ]
    if mode == "missing":
        facts[0].pop(field)
    else:
        facts[0][field] = None
    with pytest.raises(DBAPIError, match="Invalid initial zero-spending basis"):
        with Session(planning["auth"].engine) as db, db.begin():
            db.add(
                ZeroSpendingDeclaration(
                    context_id="MJL",
                    activity_id=activity["id"],
                    approved_revision_id=activity["approved_revision_id"],
                    snapshot={
                        "total": "0",
                        "operations": facts,
                        "excluded_reviewer_ids": [agent_id],
                    },
                    reason="Snapshot incomplet.",
                    submitter_id=agent_id,
                    submitted_at=planning["auth"].now(db),
                    state="submitted",
                )
            )
            db.flush()


def test_used_zero_spending_migration_refuses_destructive_downgrade(planning, auth_env):
    activity = finish_activity(planning, amounts=(0, 0))
    response = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    )
    assert response.status_code == 201
    with pytest.raises(Exception, match="Refusing destructive PTA-7A downgrade"):
        command.downgrade(Config("alembic.ini"), "0017_pta6a")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0027_pta_metadata"
        )


@pytest.mark.parametrize("first", ["declaration", "correction"])
def test_declaration_and_execution_correction_serialize(planning, first):
    activity = finish_activity(planning, amounts=(0, 0))
    operation = activity["operations"][0]

    def declare():
        return post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "reason": "Aucune dépense.",
            },
        )

    def correct():
        return patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "record",
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "actual_spent": "1",
                "execution_completed": True,
                "execution_observation": "Correction concurrente.",
                "correction_reason": "Montant retrouvé.",
            },
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        declare if first == "declaration" else correct,
        correct if first == "declaration" else declare,
    )
    assert first_response.status_code in {200, 201}
    assert second_response.status_code == 409
    history = planning["validator"].get(collection(activity)).json()
    assert history["count"] == (1 if first == "declaration" else 0)


def test_audit_failure_rolls_back_zero_declaration(planning, monkeypatch):
    activity = finish_activity(planning, amounts=(0, 0))

    def reject_audit(*_args, **_kwargs):
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(planning["auth"], "business_audit", reject_audit)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "reason": "Aucune dépense.",
            },
        )
    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(func.count()).select_from(ZeroSpendingDeclaration)) == 0
        stored = db.get(Activity, activity["id"])
        assert stored is not None
        assert stored.version == activity["version"]


def test_decision_audit_failure_rolls_back_decision_and_state(planning, monkeypatch):
    activity = finish_activity(planning, amounts=(0, 0))
    declaration = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()

    def reject_audit(*_args, **_kwargs):
        raise RuntimeError("synthetic decision audit failure")

    monkeypatch.setattr(planning["auth"], "business_audit", reject_audit)
    with pytest.raises(RuntimeError, match="synthetic decision audit failure"):
        post(
            planning["supervisor"],
            f"{collection(activity)}/{declaration['id']}/decisions",
            {
                "expected_version": declaration["activity_version"],
                "decision": "prevalidate",
            },
        )
    with Session(planning["auth"].engine) as db:
        stored = db.get(ZeroSpendingDeclaration, declaration["id"])
        assert stored is not None and stored.state == "submitted"
        assert db.scalar(select(func.count()).select_from(ZeroSpendingDecision)) == 0
        assert (
            db.get(Activity, activity["id"]).version == declaration["activity_version"]
        )


@pytest.mark.parametrize("first", ["approval", "closure"])
def test_final_decision_and_closure_serialize(planning, first):
    activity = finish_activity(planning, amounts=(0, 0))
    declaration = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Aucune dépense.",
        },
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"{collection(activity)}/{declaration['id']}/decisions",
        {
            "expected_version": declaration["activity_version"],
            "decision": "prevalidate",
        },
    ).json()

    def approve():
        return post(
            planning["validator"],
            f"{collection(activity)}/{declaration['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    def close():
        return post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/closure",
            {"expected_version": prevalidated["activity_version"]},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        approve if first == "approval" else close,
        close if first == "approval" else approve,
    )
    approval = first_response if first == "approval" else second_response
    closure = second_response if first == "approval" else first_response
    assert approval.status_code == 201, approval.text
    assert closure.status_code == 409
    fresh_close = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/closure",
        {"expected_version": approval.json()["activity_version"]},
    )
    assert fresh_close.status_code == 200, fresh_close.text


def test_zero_spending_openapi_exposes_only_list_submit_and_decisions(planning):
    paths = planning["agent"].get("/openapi.json").json()["paths"]
    collection_path = "/api/v1/activities/{identifier}/zero-spending-declarations"
    decision_path = collection_path + "/{declaration_id}/decisions"
    assert set(paths[collection_path]) == {"get", "post"}
    assert set(paths[decision_path]) == {"post"}
