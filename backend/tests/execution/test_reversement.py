# ruff: noqa: F401, F811
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction

from app.auth.models import Audit
from app.auth.service import AuthError
from app.planning.models import ReversementDeclaration, VirementConfirmation
from app.planning.reversement import required_amount
from tests.auth.test_access import headers
from tests.execution.test_virement import (
    approved_virement,
    submit_virement,
    virement_collection,
)
from tests.planning.test_planning import admin, ordered_advisory_race, planning, post


def confirmed_virement(
    clients, *, amounts=(80_000, 120_000), allocations=(100_000, 200_000)
):
    activity, source, request = approved_virement(
        clients, amounts=amounts, allocations=allocations
    )
    confirmation_path = f"{virement_collection(activity)}/{request['id']}/confirmation"
    confirmation = post(
        clients["agent"],
        confirmation_path,
        {
            "expected_version": request["activity_version"],
            "transfer_date": "2026-10-27",
            "note": "Virement externe TEST",
        },
    )
    assert confirmation.status_code == 201, confirmation.text
    return activity, source, request, confirmation.json(), confirmation_path


def reversement_path(activity, request):
    return f"{virement_collection(activity)}/{request['id']}/reversement"


def test_agent_declares_exact_reversement_and_corrects_history(planning):
    activity, _source, request, confirmation, _confirmation_path = confirmed_virement(
        planning
    )
    detail = planning["supervisor"].get(
        f"{virement_collection(activity)}/{request['id']}"
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["reversement"] == {
        "required_amount": "100000",
        "declared_amount": "0",
        "status": "required",
        "current_declaration": None,
        "allowed_actions": ["read"],
    }

    path = reversement_path(activity, request)
    declared = post(
        planning["agent"],
        path,
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": "REVERSEMENT-001",
        },
    )
    assert declared.status_code == 201, declared.text
    assert declared.headers["location"] == f"http://localhost{path}"
    assert declared.json()["returned_amount"] == "100000"
    assert declared.json()["revision"] == 1

    corrected = post(
        planning["agent2"],
        path + "/corrections",
        {
            "expected_version": declared.json()["activity_version"],
            "return_date": "2026-10-29",
            "note": "REVERSEMENT-002",
            "reason": "Correction de la date et de la référence.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    assert corrected.headers["location"] == f"http://localhost{path}"
    assert corrected.json()["revision"] == 2
    assert corrected.json()["confirmation_id"] == confirmation["id"]

    history = planning["validator"].get(path + "/history")
    assert history.status_code == 200, history.text
    assert history.json()["count"] == 2
    assert [row["revision"] for row in history.json()["data"]] == [2, 1]
    assert history.json()["data"][1]["note"] == "REVERSEMENT-001"

    current = (
        planning["agent"].get(f"{virement_collection(activity)}/{request['id']}").json()
    )
    assert current["reversement"]["status"] == "declared"
    assert current["reversement"]["declared_amount"] == "100000"
    assert current["reversement"]["allowed_actions"] == ["read", "correct"]
    assert "correct_confirmation" not in current["allowed_actions"]
    assert planning["validator"].get(path + "/history?limit=101").status_code == 422


def test_reversement_history_has_absolute_bidirectional_cursor_links(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    path = reversement_path(activity, request)
    current_version = confirmation["activity_version"]
    for revision in range(1, 4):
        target = path if revision == 1 else path + "/corrections"
        body = {
            "expected_version": current_version,
            "return_date": "2026-10-28",
            "note": f"Référence {revision}",
        }
        if revision > 1:
            body["reason"] = f"Correction {revision}."
        response = post(planning["agent"], target, body)
        assert response.status_code == 201, response.text
        current_version = response.json()["activity_version"]

    first = planning["validator"].get(path + "/history?limit=1").json()
    assert [row["revision"] for row in first["data"]] == [3]
    assert first["next"].startswith("http://localhost/api/v1/")
    assert first["previous"] is None
    second = planning["validator"].get(first["next"]).json()
    assert [row["revision"] for row in second["data"]] == [2]
    assert second["next"].startswith("http://localhost/api/v1/")
    assert second["previous"].startswith("http://localhost/api/v1/")
    third = planning["validator"].get(second["next"]).json()
    assert [row["revision"] for row in third["data"]] == [1]
    assert third["next"] is None
    back_to_second = planning["validator"].get(third["previous"]).json()
    assert [row["revision"] for row in back_to_second["data"]] == [2]
    assert back_to_second["next"].startswith("http://localhost/api/v1/")
    back_to_first = planning["validator"].get(back_to_second["previous"]).json()
    assert [row["revision"] for row in back_to_first["data"]] == [3]
    assert back_to_first["previous"] is None


def test_reversement_formula_and_large_exact_xof(planning):
    assert required_amount({"allocation": "3000000"}, 2_700_000) == 300_000
    assert required_amount({"allocation": "3000000"}, 3_000_000) == 0
    with pytest.raises(AuthError, match="financial_insufficiency_unresolved"):
        required_amount({"allocation": "3000000"}, 3_000_001)

    activity, _source, request, confirmation, _ = confirmed_virement(
        planning,
        amounts=(4_000_000_000, 5_000_000_000),
        allocations=(4_100_000_000, 5_400_000_000),
    )
    maximum = "é" * 4000
    declared = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": maximum,
        },
    )
    assert declared.status_code == 201, declared.text
    assert declared.json()["returned_amount"] == "500000000"
    corrected = post(
        planning["agent2"],
        reversement_path(activity, request) + "/corrections",
        {
            "expected_version": declared.json()["activity_version"],
            "return_date": "2026-10-29",
            "note": None,
            "reason": maximum,
        },
    )
    assert corrected.status_code == 201, corrected.text
    assert corrected.json()["correction_reason"] == maximum


def test_zero_reversement_is_settled_without_declaration(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(
        planning,
        amounts=(100_000, 200_000),
        allocations=(100_000, 200_000),
    )
    detail = (
        planning["agent"].get(f"{virement_collection(activity)}/{request['id']}").json()
    )
    assert detail["reversement"] == {
        "required_amount": "0",
        "declared_amount": "0",
        "status": "not_required",
        "current_declaration": None,
        "allowed_actions": ["read"],
    }
    rejected = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": None,
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "reversement_not_required"
    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(ReversementDeclaration.id)) is None
        assert (
            db.scalar(select(Audit.id).where(Audit.action.like("reversement.%")))
            is None
        )


def test_reversement_rejects_client_amount_role_dates_and_noop(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    path = reversement_path(activity, request)
    body = {
        "expected_version": confirmation["activity_version"],
        "return_date": "2026-10-28",
        "note": "TEST",
    }
    assert post(planning["agent"], path, {**body, "amount": "1"}).status_code == 422
    assert (
        post(planning["agent"], path, {**body, "return_date": "2026-10-26"}).status_code
        == 422
    )
    assert (
        post(planning["agent"], path, {**body, "return_date": "2999-01-01"}).status_code
        == 422
    )
    declared = post(planning["agent"], path, body)
    assert declared.status_code == 201, declared.text
    unchanged = post(
        planning["agent2"],
        path + "/corrections",
        {
            **body,
            "expected_version": declared.json()["activity_version"],
            "reason": "Aucun changement.",
        },
    )
    assert unchanged.status_code == 409
    assert unchanged.json()["code"] == "reversement_unchanged"


def test_reversement_enforces_roles_origin_scope_and_active_session(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    other_activity, _other_source, other_request, _other_confirmation, _ = (
        confirmed_virement(planning)
    )
    path = reversement_path(activity, request)
    body = {
        "expected_version": confirmation["activity_version"],
        "return_date": "2026-10-28",
        "note": "TEST",
    }
    assert post(planning["supervisor"], path, body).status_code == 403
    assert post(planning["validator"], path, body).status_code == 403
    assert post(planning["admin"], path, body).status_code == 403
    assert planning["agent"].post(path, json=body).status_code in {401, 403}
    wrong_origin = headers(planning["agent"])
    wrong_origin["Origin"] = "https://attacker.invalid"
    assert (
        planning["agent"].post(path, headers=wrong_origin, json=body).status_code == 403
    )
    assert (
        post(
            planning["agent"],
            f"{virement_collection(activity)}/not-a-request/reversement",
            body,
        ).status_code
        == 404
    )
    foreign = post(
        planning["agent"],
        f"{virement_collection(activity)}/{other_request['id']}/reversement",
        body,
    )
    assert foreign.status_code == 404
    assert other_activity["id"] != activity["id"]


def test_reversement_rejects_already_inactive_agent(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "agent2@example.test"
    )
    revoked_headers = headers(planning["agent2"])
    deactivated = planning["admin"].patch(
        f"/api/v1/access/users/{account['id']}",
        headers=headers(planning["admin"]),
        json={"expected_version": account["version"], "deactivate": True},
    )
    assert deactivated.status_code == 200, deactivated.text
    assert (
        planning["agent2"]
        .post(
            reversement_path(activity, request),
            headers=revoked_headers,
            json={
                "expected_version": confirmation["activity_version"],
                "return_date": "2026-10-28",
                "note": None,
            },
        )
        .status_code
        == 401
    )


def test_reversement_requires_approved_virement_and_current_confirmation(planning):
    activity, _source, unapproved = submit_virement(planning)
    body = {
        "expected_version": unapproved["activity_version"],
        "return_date": "2026-10-28",
        "note": None,
    }
    rejected = post(planning["agent"], reversement_path(activity, unapproved), body)
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "virement_not_approved"

    approved_activity, _source, approved = approved_virement(planning)
    missing = post(
        planning["agent"],
        reversement_path(approved_activity, approved),
        {
            "expected_version": approved["activity_version"],
            "return_date": "2026-10-28",
            "note": None,
        },
    )
    assert missing.status_code == 409
    assert missing.json()["code"] == "virement_confirmation_required"


def test_reversement_rechecks_locked_financial_and_latest_confirmation_basis(
    planning, monkeypatch
):
    activity, _source, request, confirmation, confirmation_path = confirmed_virement(
        planning
    )
    import app.planning.virement as virement_module

    original_basis = virement_module.verified_financial_basis

    def stale_spending(db, item):
        total, operations, authors = original_basis(db, item)
        return total + 1, operations, authors

    monkeypatch.setattr(virement_module, "verified_financial_basis", stale_spending)
    stale = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": None,
        },
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "financial_basis_stale"
    monkeypatch.setattr(virement_module, "verified_financial_basis", original_basis)

    corrected = post(
        planning["agent2"],
        confirmation_path + "/corrections",
        {
            "expected_version": confirmation["activity_version"],
            "transfer_date": "2026-10-28",
            "note": "Confirmation actuelle",
            "reason": "Correction avant reversement.",
        },
    )
    assert corrected.status_code == 201, corrected.text

    import app.planning.reversement as reversement_module

    original_current = reversement_module.current_confirmation

    def stale_confirmation(db, request_id, *, lock=False):
        statement = select(VirementConfirmation).where(
            VirementConfirmation.id == confirmation["id"]
        )
        if lock:
            statement = statement.with_for_update()
        return db.scalar(statement)

    monkeypatch.setattr(reversement_module, "current_confirmation", stale_confirmation)
    rejected = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": corrected.json()["activity_version"],
            "return_date": "2026-10-29",
            "note": None,
        },
    )
    assert rejected.status_code == 503
    monkeypatch.setattr(reversement_module, "current_confirmation", original_current)
    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(ReversementDeclaration.id)) is None


def test_reversement_is_immutable_serialized_and_freezes_confirmation(planning):
    activity, _source, request, confirmation, confirmation_path = confirmed_virement(
        planning
    )
    path = reversement_path(activity, request)
    body = {
        "expected_version": confirmation["activity_version"],
        "return_date": "2026-10-28",
        "note": None,
    }
    responses = ordered_advisory_race(
        planning["auth"],
        lambda: post(planning["agent"], path, body),
        lambda: post(planning["agent2"], path, body),
    )
    assert sorted(response.status_code for response in responses) == [201, 409]
    winner = next(
        response.json() for response in responses if response.status_code == 201
    )

    frozen = post(
        planning["agent"],
        confirmation_path + "/corrections",
        {
            "expected_version": winner["activity_version"],
            "transfer_date": "2026-10-28",
            "note": "Correction tardive",
            "reason": "Tentative après reversement.",
        },
    )
    assert frozen.status_code == 409
    assert frozen.json()["code"] == "confirmation_frozen"

    with Session(planning["auth"].engine) as db:
        declaration = db.scalar(select(ReversementDeclaration))
        assert declaration
        declaration_id = declaration.id
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text("UPDATE pta_reversement_declaration SET amount=1 WHERE id=:id"),
            {"id": declaration_id},
        )
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "INSERT INTO pta_virement_confirmation"
                "(id,activity_id,request_id,revision,amount,transfer_date,note,"
                "actor_id,recorded_at,correction_reason) "
                "SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',activity_id,"
                "request_id,revision+1,amount,transfer_date,NULL,actor_id,"
                "recorded_at+interval '1 second','Correction directe' "
                "FROM pta_virement_confirmation WHERE id=:id"
            ),
            {"id": confirmation["id"]},
        )


def test_reversement_openapi_has_only_three_responsibilities(planning):
    paths = planning["agent"].app.openapi()["paths"]
    base = "/api/v1/activities/{identifier}/virement-requests/{request_id}/reversement"
    assert set(paths[base]) == {"post"}
    assert set(paths[base + "/corrections"]) == {"post"}
    assert set(paths[base + "/history"]) == {"get"}
    schemas = planning["agent"].app.openapi()["components"]["schemas"]
    assert schemas["ReversementDeclarationInput"]["additionalProperties"] is False
    assert schemas["ReversementCorrectionInput"]["additionalProperties"] is False


def test_reversement_schema_guard_and_destructive_downgrade(planning, auth_env):
    with planning["auth"].engine.connect() as db:
        transaction = db.begin()
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION pta_preserve_reversement_declaration() "
                "RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$"
            )
        )
        with pytest.raises(AuthError, match="eligibility_unverified"):
            planning["auth"].environment_verified(db)
        transaction.rollback()

    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    declared = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": None,
        },
    )
    assert declared.status_code == 201, declared.text
    planning["auth"].engine.dispose()
    with pytest.raises(Exception, match="Refusing destructive PTA-3E downgrade"):
        command.downgrade(Config("alembic.ini"), "0013_pta3d")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0024_budget_funding"
            )
    finally:
        engine.dispose()


@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_reversement_failure_rolls_back_all_effects(planning, monkeypatch, failure):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    path = reversement_path(activity, request)
    with planning["auth"].engine.connect() as db:
        before = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_reversement_declaration "
                "WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit "
                "WHERE action LIKE 'reversement.%' "
                "AND business->>'activity_id'=:id) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    original = planning["auth"].business_audit

    def inject_failure(db, action, *args, **kwargs):
        if action == "reversement.declared" and failure == "audit":
            raise RuntimeError("synthetic reversement audit failure")
        result = original(db, action, *args, **kwargs)
        if action == "reversement.declared" and failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        if action == "reversement.declared" and failure == "commit":
            db.info["fail_reversement_commit"] = True
        return result

    monkeypatch.setattr(planning["auth"], "business_audit", inject_failure)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_reversement_commit", False):
                raise IntegrityError(
                    "synthetic reversement commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)

    body = {
        "expected_version": confirmation["activity_version"],
        "return_date": "2026-10-28",
        "note": None,
    }
    if failure == "audit":
        with pytest.raises(RuntimeError, match="synthetic reversement audit failure"):
            post(planning["agent"], path, body)
    else:
        assert post(planning["agent"], path, body).status_code == 503
    with planning["auth"].engine.connect() as db:
        after = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_reversement_declaration "
                "WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit "
                "WHERE action LIKE 'reversement.%' "
                "AND business->>'activity_id'=:id) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    assert after == before


def test_deactivation_serializes_before_reversement(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "agent2@example.test"
    )
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
        lambda: post(
            planning["agent2"],
            reversement_path(activity, request),
            {
                "expected_version": confirmation["activity_version"],
                "return_date": "2026-10-28",
                "note": None,
            },
        ),
    )
    assert (deactivated.status_code, denied.status_code) == (200, 401)
    with Session(planning["auth"].engine) as db:
        assert db.scalar(select(ReversementDeclaration.id)) is None


def test_confirmation_correction_commits_before_fresh_reversement(planning):
    activity, _source, request, confirmation, confirmation_path = confirmed_virement(
        planning
    )
    corrected = post(
        planning["agent2"],
        confirmation_path + "/corrections",
        {
            "expected_version": confirmation["activity_version"],
            "transfer_date": "2026-10-28",
            "note": "Confirmation corrigée",
            "reason": "Correction avant reversement.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    declared = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": corrected.json()["activity_version"],
            "return_date": "2026-10-29",
            "note": None,
        },
    )
    assert declared.status_code == 201, declared.text
    assert declared.json()["confirmation_id"] == corrected.json()["id"]


@pytest.mark.parametrize("first", ["reversement", "confirmation"])
def test_confirmation_correction_and_reversement_have_one_serial_winner(
    planning, first
):
    activity, _source, request, confirmation, confirmation_path = confirmed_virement(
        planning
    )

    def declaration():
        return post(
            planning["agent"],
            reversement_path(activity, request),
            {
                "expected_version": confirmation["activity_version"],
                "return_date": "2026-10-29",
                "note": None,
            },
        )

    def correction():
        return post(
            planning["agent2"],
            confirmation_path + "/corrections",
            {
                "expected_version": confirmation["activity_version"],
                "transfer_date": "2026-10-28",
                "note": "Correction concurrente",
                "reason": "Correction concurrente avant reversement.",
            },
        )

    responses = ordered_advisory_race(
        planning["auth"],
        declaration if first == "reversement" else correction,
        correction if first == "reversement" else declaration,
    )
    assert [response.status_code for response in responses] == [201, 409]
    with Session(planning["auth"].engine) as db:
        declarations = list(db.scalars(select(ReversementDeclaration)))
    assert len(declarations) == (1 if first == "reversement" else 0)


def test_exact_pta3d_predecessor_upgrades_without_rewriting_facts(
    planning, auth_env, monkeypatch
):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    tables = (
        "pta_activity",
        "pta_operation",
        "pta_activity_revision",
        "pta_disbursement_request",
        "pta_disbursement_decision",
        "pta_virement_request",
        "pta_virement_decision",
        "pta_virement_confirmation",
        "auth_audit",
    )

    def fingerprints(engine):
        with engine.connect() as db:
            return {
                table: db.scalar(
                    text(
                        "SELECT md5(COALESCE(jsonb_agg("
                        + (
                            "to_jsonb(source)-'closed_at'-'closed_by_id' "
                            if table == "pta_activity"
                            else "to_jsonb(source) "
                        )
                        + f"ORDER BY id)::text,'[]')) FROM {table} source"
                    )
                )
                for table in tables
            }

    before = fingerprints(planning["auth"].engine)
    planning["auth"].engine.dispose()
    monkeypatch.setenv("DATABASE_URL", auth_env.url)
    config = Config("alembic.ini")
    command.downgrade(config, "0013_pta3d")
    predecessor = create_engine(auth_env.url)
    try:
        assert fingerprints(predecessor) == before
        with predecessor.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0013_pta3d"
            )
            assert "pta_reversement_declaration" not in inspect(db).get_table_names()
    finally:
        predecessor.dispose()
    command.upgrade(config, "head")
    candidate = create_engine(auth_env.url)
    try:
        assert fingerprints(candidate) == before
        with candidate.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0024_budget_funding"
            )
            assert (
                db.scalar(text("SELECT count(*) FROM pta_reversement_declaration")) == 0
            )
    finally:
        candidate.dispose()
    declared = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": "Premier reversement après migration.",
        },
    )
    assert declared.status_code == 201, declared.text
    assert declared.json()["returned_amount"] == "100000"
