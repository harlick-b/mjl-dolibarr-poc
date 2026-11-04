# ruff: noqa: F401, F811
import re
from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session
from test_amendments import (
    approved_activity,
    cancel_amendment,
    edit_amendment,
    open_amendment,
)
from test_closure import close_path, settled_activity
from test_disbursement import collection, finish_activity
from test_execution import approved_execution_activity, execution_path
from test_planning import admin, patch, plan, planning, post, references
from test_withdrawals import enable_withdrawals

from app.auth.models import Audit
from app.planning import fiche


def fiche_path(activity):
    return f"/api/v1/activities/{activity['id']}/fiche.pdf"


def pdf_text(response):
    return "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages
    )


def test_closed_activity_fiche_contains_authoritative_history_and_is_audited(planning):
    activity, _request, version = settled_activity(planning)
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text

    response = planning["agent"].get(fiche_path(activity))
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="fiche-{activity["reference"]}.pdf"'
    )
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.content.startswith(b"%PDF")
    content = pdf_text(response)
    for expected in (
        "FICHE RÉCAPITULATIVE D’ACTIVITÉ",
        activity["reference"],
        "Planification approuvée",
        "Partenaire test",
        "Projet test",
        "Générée le",
        "300 000 F CFA",
        "80 000 F CFA",
        "120 000 F CFA",
        "200 000 F CFA",
        "100 000 F CFA",
        "Confirmation virement",
        "Reversement déclaré",
        "Clôturée",
        "Pièces justificatives",
        "Aucune pièce enregistrée",
    ):
        assert expected in content
    assert re.search(r"Montant à reverser\s+100 000 F CFA", content)
    assert re.search(r"Montant reversé\s+100 000 F CFA", content)
    normalized = re.sub(r"\s+", " ", content)
    assert "activity." not in normalized
    assert re.search(
        r"Confirmation virement · révision 1 .*? par agent@example\.test",
        normalized,
    )
    assert re.search(
        r"Reversement déclaré · révision 1 .*? par agent@example\.test",
        normalized,
    )

    with Session(planning["auth"].engine) as db:
        audit = db.scalar(
            select(Audit).where(
                Audit.action == "activity.fiche_generated",
                Audit.target == activity["id"],
            )
        )
        assert audit is not None
        assert audit.details == {
            "role": "AGENT_SAISIE",
            "version": closed.json()["version"],
        }


def test_fiche_access_requires_an_approved_activity_and_business_role(planning):
    activity = approved_execution_activity(planning)
    for role in ("agent", "supervisor", "validator"):
        assert planning[role].get(fiche_path(activity)).status_code == 200
    assert planning["admin"].get(fiche_path(activity)).status_code == 403
    assert (
        planning["agent"].get(f"/api/v1/activities/{uuid4()}/fiche.pdf").status_code
        == 404
    )

    _partner, operation_type, project = references(planning)
    draft = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    )
    assert draft.status_code == 201, draft.text
    unavailable = planning["agent"].get(fiche_path(draft.json()))
    assert unavailable.status_code == 409
    assert unavailable.json()["code"] == "fiche_unavailable"


def test_fiche_preserves_approved_baseline_and_unknown_spending(planning):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "Adapter le contenu.")
    candidate = edit_amendment(
        planning,
        opened,
        operation_type,
        "CONTENU CANDIDAT NON APPROUVÉ",
    )

    response = planning["supervisor"].get(fiche_path(candidate))
    assert response.status_code == 200, response.text
    content = pdf_text(response)
    assert "Planification complète de test" in content
    assert "CONTENU CANDIDAT NON APPROUVÉ" not in content
    assert re.search(r"Montant à reverser\s+Non renseigné", content)
    assert re.search(r"Montant reversé\s+Non renseigné", content)


def test_fiche_uses_approved_operation_type_during_pending_amendment(planning):
    approved, _operation_type = approved_activity(planning)
    candidate_type = post(
        planning["validator"],
        "/api/v1/operation-types",
        {"label": "Type candidat non approuvé"},
    ).json()
    opened = open_amendment(planning, approved, "Changer le type d’opération.")
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            candidate_type,
            description="CONTENU CANDIDAT NON APPROUVÉ",
            allocation=approved["allocation"],
            operations=[
                {
                    **{key: value for key, value in row.items() if key != "position"},
                    "type_id": candidate_type["id"],
                }
                for row in approved["operations"]
            ],
            expected_version=opened["version"],
        ),
    )
    assert changed.status_code == 200, changed.text

    content = pdf_text(planning["supervisor"].get(fiche_path(approved)))
    assert "Formation" in content
    assert "Type candidat non approuvé" not in content


def test_fiche_renders_requested_amount_and_audit_reasons_in_french(planning):
    approved, operation_type = approved_activity(planning)
    open_reason = "Adapter le budget après vérification."
    opened = open_amendment(planning, approved, open_reason)
    candidate = edit_amendment(
        planning,
        opened,
        operation_type,
        "Contenu proposé pour correction.",
    )
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": candidate["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": revision["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    returned = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "return",
            "reason": "Réviser le montant proposé.",
            "requested_amount": "350000",
        },
    )
    assert returned.status_code == 201, returned.text

    returned_content = re.sub(
        r"\s+", " ", pdf_text(planning["agent"].get(fiche_path(approved)))
    )
    assert "Montant demandé : 350 000 F CFA" in returned_content

    cancellation_reason = "Abandonner cette correction budgétaire."
    returned_activity = (
        planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    )
    cancelled = cancel_amendment(
        planning, returned_activity, reason=cancellation_reason
    )
    cancelled_content = re.sub(
        r"\s+", " ", pdf_text(planning["agent"].get(fiche_path(cancelled)))
    )
    assert open_reason in cancelled_content
    assert cancellation_reason in cancelled_content
    assert "Ouverture de modification" in cancelled_content
    assert "Annulation de modification" in cancelled_content
    assert "activity." not in cancelled_content


def test_fiche_renders_withdrawal_submission_reason(planning):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    withdrawal_reason = "Le programme annuel ne permet plus cette activité."
    response = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": withdrawal_reason,
        },
    )
    assert response.status_code == 201, response.text

    content = re.sub(r"\s+", " ", pdf_text(planning["agent"].get(fiche_path(approved))))
    assert withdrawal_reason in content


def test_fiche_renders_execution_corrections_and_financial_return(planning):
    activity = approved_execution_activity(planning, allocations=(100_000, 200_000))
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    recorded = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "90000",
            "execution_completed": True,
            "execution_observation": "Première saisie.",
        },
    ).json()
    correction_reason = "Montant corrigé après contrôle."
    corrected = patch(
        planning["agent2"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": recorded["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "80000",
            "execution_completed": True,
            "execution_observation": "Montant vérifié.",
            "correction_reason": correction_reason,
        },
    )
    assert corrected.status_code == 200, corrected.text
    correction_content = pdf_text(planning["validator"].get(fiche_path(activity)))
    assert "Réalisation corrigée" in correction_content
    assert "operation.execution_corrected" not in correction_content
    normalized = re.sub(r"\s+", " ", correction_content)
    assert correction_reason in normalized
    assert "90 000 F CFA → 80 000 F CFA" in normalized
    assert "Première saisie. → Montant vérifié." in normalized
    assert "terminé Oui → Oui" in normalized

    complete = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(complete),
        {
            "expected_version": complete["version"],
            "expected_approved_revision_id": complete["approved_revision_id"],
        },
    ).json()
    return_reason = "Justifier les dépenses enregistrées."
    returned = post(
        planning["supervisor"],
        f"{collection(complete)}/{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "return",
            "reason": return_reason,
        },
    )
    assert returned.status_code == 201, returned.text
    financial_content = pdf_text(planning["agent"].get(fiche_path(complete)))
    financial_content = re.sub(r"\s+", " ", financial_content)
    assert "Retourné" in financial_content
    assert return_reason in financial_content
    assert "Annulation décaissement" not in financial_content


def test_fiche_splits_valid_maximum_length_description(planning):
    _partner, operation_type, project = references(planning)
    description = "É" * 4000
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(operation_type, description=description),
            "request_key": str(uuid4()),
        },
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201, approved.text
    response = planning["agent"].get(fiche_path(created))
    assert response.status_code == 200, response.text
    assert len(PdfReader(BytesIO(response.content)).pages) > 1


def test_openapi_describes_the_pdf_success_response(planning):
    contract = planning["agent"].get("/openapi.json").json()
    operation = contract["paths"]["/api/v1/activities/{identifier}/fiche.pdf"]["get"]
    assert "application/pdf" in operation["responses"]["200"]["content"]
    schemes = contract["components"]["securitySchemes"]
    assert schemes["LocalSession"]["name"] == "mjl_local"
    assert schemes["SecureSession"]["name"] == "__Host-mjl"
    assert {tuple(entry) for entry in operation["security"]} == {
        ("LocalSession",),
        ("SecureSession",),
    }


def test_failed_render_rolls_back_generation_audit(planning, monkeypatch):
    activity = approved_execution_activity(planning)

    def fail(_data):
        raise RuntimeError("synthetic render failure")

    monkeypatch.setattr(fiche, "render_fiche", fail)
    with pytest.raises(RuntimeError, match="synthetic render failure"):
        planning["agent"].get(fiche_path(activity))
    with Session(planning["auth"].engine) as db:
        assert (
            db.scalar(
                select(Audit.id).where(
                    Audit.action == "activity.fiche_generated",
                    Audit.target == activity["id"],
                )
            )
            is None
        )
