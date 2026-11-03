# ruff: noqa: F401, F811
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from test_disbursement import collection, finish_activity
from test_execution import execution_path
from test_fiche import fiche_path, pdf_text
from test_planning import admin, ordered_advisory_race, patch, planning, post
from test_virement import submit_virement, virement_collection


def test_empty_migration_round_trip_preserves_exact_guards(auth_env):
    engine = create_engine(auth_env.url)
    config = Config("alembic.ini")

    def definitions():
        with engine.connect() as db:
            return [
                db.scalar(
                    text(
                        f"SELECT pg_get_functiondef('pta_preserve_{kind}()'"
                        "::regprocedure)"
                    )
                )
                for kind in ("disbursement", "virement")
            ] + list(
                db.execute(
                    text(
                        "SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN "
                        "('disbursement_one_open_per_activity', "
                        "'virement_one_open_per_activity') ORDER BY indexname"
                    )
                )
            )

    try:
        current = definitions()
        command.downgrade(config, "0020_pta9a")
        previous = definitions()
        assert all(
            "OLD.state='returned' AND NEW.state='cancelled'" in definition
            for definition in previous[:2]
        )
        command.upgrade(config, "head")
        assert definitions() == current
        command.downgrade(config, "0020_pta9a")
        assert definitions() == previous
        command.upgrade(config, "head")
    finally:
        engine.dispose()


def request_fixture(planning, kind):
    if kind == "virement":
        activity, source, request = submit_virement(planning)
        return (
            activity,
            virement_collection(activity),
            request,
            {"expected_disbursement_request_id": source["id"]},
        )
    activity = finish_activity(planning)
    basis = {"expected_approved_revision_id": activity["approved_revision_id"]}
    response = post(
        planning["agent"],
        collection(activity),
        {"expected_version": activity["version"], **basis},
    )
    assert response.status_code == 201, response.text
    return activity, collection(activity), response.json(), basis


def decide(planning, path, request, decision, role="supervisor"):
    response = post(
        planning[role],
        f"{path}/{request['id']}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": decision,
            **({"reason": "Montant à vérifier."} if decision == "return" else {}),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("kind", ["disbursement", "virement"])
def test_return_rollback_then_concurrent_fresh_submission(planning, monkeypatch, kind):
    activity, path, request, basis = request_fixture(planning, kind)
    auth = planning["auth"]
    original = auth.business_audit

    def fail(db, action, actor, target, business):
        if action == f"{kind}.returned":
            raise RuntimeError("synthetic return audit failure")
        return original(db, action, actor, target, business)

    with monkeypatch.context() as scoped:
        scoped.setattr(auth, "business_audit", fail)
        with pytest.raises(RuntimeError, match="synthetic return audit failure"):
            decide(planning, path, request, "return")
    unchanged = planning["agent"].get(f"{path}/{request['id']}").json()
    assert unchanged["state"] == "submitted"
    assert unchanged["decisions"] == []
    assert unchanged["activity_version"] == request["activity_version"]
    returned = decide(planning, path, request, "return")
    body = {"expected_version": returned["activity_version"], **basis}
    responses = ordered_advisory_race(
        auth,
        lambda: post(planning["agent"], path, body),
        lambda: post(planning["agent2"], path, body),
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    fresh = next(
        response.json() for response in responses if response.status_code == 201
    )
    assert fresh["decisions"] == []
    skipped_review = post(
        planning["validator"],
        f"{path}/{fresh['id']}/decisions",
        {
            "expected_version": fresh["activity_version"],
            "decision": "approve",
        },
    )
    assert skipped_review.status_code == 409
    history = planning["agent"].get(path).json()["data"]
    assert sorted(row["state"] for row in history) == ["returned", "submitted"]
    assert (
        planning["agent"].get(f"{path}/{request['id']}").json()["decisions"]
        == returned["decisions"]
    )


@pytest.mark.parametrize("kind", ["disbursement", "virement"])
def test_returned_database_terminal_and_migration_preserves_legacy_cancellation(
    planning, kind
):
    _, path, request, basis = request_fixture(planning, kind)
    returned = decide(planning, path, request, "return")
    engine = planning["auth"].engine
    sql = text(
        f"UPDATE pta_{kind}_request SET state='cancelled', "
        "cancelled_by_id=submitter_id, cancelled_at=clock_timestamp(), "
        "cancellation_reason='Ancien contrôle' WHERE id=:id"
    )
    with (
        pytest.raises(DBAPIError, match=f"Invalid {kind} transition") as transition,
        engine.begin() as db,
    ):
        db.execute(sql, {"id": request["id"]})
    assert transition.value.orig.sqlstate == "P0001"
    change = (
        "amount=amount+1"
        if kind == "disbursement"
        else "excluded_reviewer_ids='[]'::jsonb"
    )
    with (
        pytest.raises(
            DBAPIError, match=f"{kind.title()} basis is immutable"
        ) as basis_error,
        engine.begin() as db,
    ):
        db.execute(
            text(f"UPDATE pta_{kind}_request SET {change} WHERE id=:id"),
            {"id": request["id"]},
        )
    assert basis_error.value.orig.sqlstate == "P0001"
    config = Config("alembic.ini")
    command.downgrade(config, "0020_pta9a")
    with engine.begin() as db:
        db.execute(sql, {"id": request["id"]})
    command.upgrade(config, "head")
    legacy = planning["agent"].get(f"{path}/{request['id']}")
    assert legacy.status_code == 200, legacy.text
    assert legacy.json()["state"] == "cancelled"
    assert legacy.json()["decisions"] == returned["decisions"]
    assert legacy.json()["cancellation"]["reason"] == "Ancien contrôle"
    fresh = post(
        planning["agent"],
        path,
        {
            "expected_version": returned["activity_version"],
            **basis,
        },
    )
    assert fresh.status_code == 201, fresh.text


@pytest.mark.parametrize("kind", ["disbursement", "virement"])
def test_downgrade_refuses_multiple_retained_returns_without_mutation(planning, kind):
    _, path, request, basis = request_fixture(planning, kind)
    returned = decide(planning, path, request, "return")
    fresh = post(
        planning["agent"],
        path,
        {
            "expected_version": returned["activity_version"],
            **basis,
        },
    )
    assert fresh.status_code == 201, fresh.text
    decide(planning, path, fresh.json(), "return")
    with pytest.raises(RuntimeError, match="retained request history"):
        command.downgrade(Config("alembic.ini"), "0020_pta9a")
    history = planning["agent"].get(path)
    assert history.status_code == 200, history.text  # exact schema guard still passes
    assert [row["state"] for row in history.json()["data"]] == ["returned", "returned"]


def test_returned_disbursement_can_be_corrected_to_zero_and_closed(planning):
    activity, path, request, _ = request_fixture(planning, "disbursement")
    returned = decide(planning, path, request, "return")
    version = returned["activity_version"]
    for operation in activity["operations"]:
        corrected = patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "record",
                "expected_version": version,
                "expected_approved_revision_id": activity["approved_revision_id"],
                "actual_spent": "0",
                "execution_completed": True,
                "execution_observation": "Moyens propres utilisés.",
                "correction_reason": "Correction après retour.",
            },
        )
        assert corrected.status_code == 200, corrected.text
        version = corrected.json()["version"]
    zero_path = f"/api/v1/activities/{activity['id']}/zero-spending-declarations"
    zero = post(
        planning["agent"],
        zero_path,
        {
            "expected_version": version,
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Moyens propres utilisés.",
        },
    )
    assert zero.status_code == 201, zero.text
    prevalidated = decide(planning, zero_path, zero.json(), "prevalidate")
    approved = decide(planning, zero_path, prevalidated, "approve", "validator")
    closed = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/closure",
        {
            "expected_version": approved["activity_version"],
        },
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["state"] == "closed"
    original = planning["agent"].get(f"{path}/{request['id']}").json()
    assert original["amount"] == "300000"
    assert original["decisions"] == returned["decisions"]
    fiche = planning["agent"].get(fiche_path(activity))
    assert fiche.status_code == 200, fiche.text
    content = pdf_text(fiche)
    assert "Montant à vérifier." in content
    assert "Dépense nulle validée" in content


def test_replacements_drive_settlement_and_closure_with_both_returns_in_history(
    planning,
):
    activity, path, request, basis = request_fixture(planning, "disbursement")
    for kind in ("disbursement", "virement"):
        returned = decide(planning, path, request, "return")
        fresh = post(
            planning["agent"],
            path,
            {
                "expected_version": returned["activity_version"],
                **basis,
            },
        )
        assert fresh.status_code == 201, fresh.text
        prevalidated = decide(planning, path, fresh.json(), "prevalidate")
        approved = decide(planning, path, prevalidated, "approve", "validator")
        if kind == "disbursement":
            path = virement_collection(activity)
            basis = {"expected_disbursement_request_id": approved["id"]}
            submitted = post(
                planning["agent"],
                path,
                {
                    "expected_version": approved["activity_version"],
                    **basis,
                },
            )
            assert submitted.status_code == 201, submitted.text
            request = submitted.json()
    confirmation = post(
        planning["agent"],
        f"{path}/{approved['id']}/confirmation",
        {
            "expected_version": approved["activity_version"],
            "transfer_date": "2026-10-27",
            "note": "Virement corrigé TEST",
        },
    )
    assert confirmation.status_code == 201, confirmation.text
    detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert detail["closure_blockers"] == []
    closed = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/closure",
        {
            "expected_version": confirmation.json()["activity_version"],
        },
    )
    assert closed.status_code == 200, closed.text
    fiche = planning["agent"].get(fiche_path(activity))
    assert fiche.status_code == 200, fiche.text
    assert pdf_text(fiche).count("Montant à vérifier.") >= 2
