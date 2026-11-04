# ruff: noqa: F401, F811
from io import BytesIO

from pypdf import PdfReader
from test_access import headers
from test_annual_export import approve_named
from test_planning import admin, planning


def pdf(client, pta_id):
    return client.post(
        f"/api/v1/ptas/{pta_id}/exports",
        headers=headers(client),
        json={"format": "pdf"},
    )


def test_pdf_contains_current_summary_and_approved_activity(planning):
    activity = approve_named(planning, "École <b>publique</b> & santé")
    response = pdf(planning["agent"], activity["pta_id"])
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].endswith('.pdf"')
    assert response.headers["cache-control"] == "no-store"
    document = PdfReader(BytesIO(response.content))
    content = "\n".join(page.extract_text() for page in document.pages)
    assert "Rapport de travail" in content
    assert "non officiel" in content
    assert "École <b>publique</b> & santé" in content
    assert "300 000" in content
    assert "Page 1" in content


def test_pdf_finance_matches_excel_and_audit(planning):
    import hashlib

    from sqlalchemy import select
    from sqlalchemy.orm import Session
    from test_annual_excel import excel, workbook_cells
    from test_closure import close_path, settled_activity
    from test_planning import post

    from app.auth.models import Audit

    activity, _, version = settled_activity(planning)
    assert (
        post(
            planning["agent"], close_path(activity), {"expected_version": version}
        ).status_code
        == 200
    )
    response = pdf(planning["validator"], activity["pta_id"])
    assert response.status_code == 200, response.text
    document = PdfReader(BytesIO(response.content))
    content = "\n".join(page.extract_text() for page in document.pages)
    _, cells = workbook_cells(excel(planning["validator"], activity["pta_id"]).content)
    for value in (cells["G2"], cells["H2"], cells["I2"]):
        assert format(int(value), ",").replace(",", " ") in content
    with Session(planning["auth"].engine) as db:
        audit = next(
            a
            for a in db.scalars(select(Audit).where(Audit.action == "pta.export"))
            if a.details["format"] == "pdf"
        )
        assert audit.details["sha256"] == hashlib.sha256(response.content).hexdigest()
        assert audit.details["byte_size"] == len(response.content)
        assert audit.details["row_count"] == 1
        assert audit.target in content


def test_pdf_scope_bound_and_audit_failure(planning, auth_env, monkeypatch):
    from contextlib import ExitStack

    from sqlalchemy import event, select
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session
    from test_partner_portal import activity_partner, invite_partner

    from app.auth.models import Audit
    from app.planning import annual_export

    activity = approve_named(planning, "Rapport PDF")
    path = f"/api/v1/ptas/{activity['pta_id']}/exports"
    for role in ("agent", "supervisor", "validator"):
        assert pdf(planning[role], activity["pta_id"]).status_code == 200
    assert pdf(planning["admin"], activity["pta_id"]).status_code == 403
    assert planning["agent"].post(path, json={"format": "pdf"}).status_code == 403
    assert pdf(planning["agent"], "missing").status_code == 404
    schema = planning["agent"].get("/openapi.json").json()
    assert (
        "application/pdf"
        in schema["paths"]["/api/v1/ptas/{identifier}/exports"]["post"]["responses"][
            "200"
        ]["content"]
    )
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning,
            auth_env,
            stack,
            activity_partner(planning["auth"], activity["id"]),
            "pdf-denied@example.test",
        )
        assert pdf(portal, activity["pta_id"]).status_code == 403
        assert (
            portal.post(
                f"/api/v1/partner-portal/ptas/{activity['pta_id']}/exports",
                headers=headers(portal),
                json={"format": "pdf"},
            ).status_code
            == 422
        )
        portal.cookies.clear()
        assert (
            portal.post(
                path,
                headers={"Origin": "http://localhost", "X-CSRF-Token": "missing"},
                json={"format": "pdf"},
            ).status_code
            == 401
        )

    def audit_count():
        with Session(planning["auth"].engine) as db:
            return len(
                list(db.scalars(select(Audit.id).where(Audit.action == "pta.export")))
            )

    before = audit_count()
    monkeypatch.setattr(annual_export, "MAX_EXPORT_ROWS", 0)
    assert pdf(planning["agent"], activity["pta_id"]).status_code == 422
    monkeypatch.undo()

    def fail(_connection, _cursor, statement, parameters, _context, _many):
        if "INSERT INTO auth_audit" in statement and "pta.export" in str(parameters):
            raise OperationalError(statement, parameters, Exception("synthetic"))

    event.listen(planning["auth"].engine, "before_cursor_execute", fail)
    try:
        failed = pdf(planning["agent"], activity["pta_id"])
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", fail)
    assert failed.status_code == 503
    assert failed.headers["content-type"].startswith("application/json")
    assert audit_count() == before


def test_pdf_pagination_literal_text_exact_amounts_and_empty_plan():
    from app.planning.annual_pdf import pdf_artifact

    rows = [
        {
            "reference": f"ACT-{index:03}",
            "name": 'Éducation <link href="https://example.test">locale</link> & santé '
            + "mot " * 25,
            "revision": 1,
            "start": "2027-01-01",
            "end": "2027-12-31",
            "state": "Approuvée",
            "allocation": "9223372036854775807",
            "spending": 0,
            "reversement_amount": None,
        }
        for index in range(65)
    ]
    content = pdf_artifact((("Projet", "Éducation et santé"),), rows)
    document = PdfReader(BytesIO(content))
    assert len(document.pages) >= 3
    text = "\n".join(page.extract_text() for page in document.pages)
    assert "9 223 372 036 854 775 807" in text
    assert "<link" in text and "locale</link>" in text
    for row in rows:
        assert row["reference"] in text
    for number, page in enumerate(document.pages, 1):
        assert f"Page {number}" in page.extract_text()
        assert not page.get("/Annots")
        assert float(page.mediabox.width) > float(page.mediabox.height)
        if "ACT-" in page.extract_text():
            assert "Budget" in page.extract_text()
    # A deliberately long wrapped row must split without losing its trailing text.
    rows[0]["name"] = "longue " * 2000 + "FIN-DU-NOM"
    long_pdf = PdfReader(BytesIO(pdf_artifact((("Exercice", 2027),), rows[:1])))
    assert "FIN-DU-NOM" in "\n".join(page.extract_text() for page in long_pdf.pages)
    empty = PdfReader(BytesIO(pdf_artifact((("Exercice", 2027),), [])))
    assert "Aucune Activité approuvée" in empty.pages[0].extract_text()
