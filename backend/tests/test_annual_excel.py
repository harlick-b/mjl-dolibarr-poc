# ruff: noqa: F401, F811
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from test_access import headers
from test_annual_export import approve_named
from test_planning import admin, planning

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def workbook_cells(content):
    with ZipFile(BytesIO(content)) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = [
                "".join(node.itertext())
                for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))
            ]
        sheets = []
        for name in ("xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"):
            root = ET.fromstring(archive.read(name))
            cells = {}
            for cell in root.findall(".//s:c", NS):
                assert cell.find("s:f", NS) is None
                value = cell.find("s:v", NS)
                if cell.get("t") == "inlineStr":
                    cells[cell.get("r")] = "".join(cell.find("s:is", NS).itertext())
                elif value is not None:
                    cells[cell.get("r")] = (
                        strings[int(value.text)] if cell.get("t") == "s" else value.text
                    )
            sheets.append(cells)
        assert not any(
            "externalLink" in name or "vbaProject" in name
            for name in archive.namelist()
        )
        return sheets


def excel(client, pta_id):
    return client.post(
        f"/api/v1/ptas/{pta_id}/exports",
        headers=headers(client),
        json={"format": "xlsx"},
    )


def test_excel_report_contains_summary_and_approved_rows(planning):
    activity = approve_named(planning, "=SUM(1;2)")
    response = excel(planning["agent"], activity["pta_id"])
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["content-disposition"].endswith('.xlsx"')
    assert response.headers["cache-control"] == "no-store"
    summary, rows = workbook_cells(response.content)
    assert "Rapport de travail — non officiel" in summary.values()
    assert "300000" in summary.values()
    assert rows["B2"] == "=SUM(1;2)"
    assert rows["G2"] == "300000"
    assert rows.get("H2", "") == ""


def test_excel_final_finance_and_audit(planning):
    import hashlib

    from sqlalchemy import select
    from sqlalchemy.orm import Session
    from test_annual_export import activity_rows, export
    from test_closure import close_path, settled_activity
    from test_planning import post

    from app.auth.models import Audit

    activity, _, version = settled_activity(planning)
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text
    response = excel(planning["validator"], activity["pta_id"])
    assert response.status_code == 200, response.text
    summary, rows = workbook_cells(response.content)
    assert [rows["G2"], rows["H2"], rows["I2"]] == ["300000", "200000", "100000"]
    assert summary["B12"] == "1"
    assert summary["B13"] == "1"
    assert summary["B15"] == "200000"
    assert summary["B16"] == "300000"
    csv_row = activity_rows(export(planning["validator"], activity["pta_id"]))[1][0]
    assert [rows["G2"], rows["H2"], rows["I2"]] == [csv_row[7], csv_row[8], csv_row[12]]
    with Session(planning["auth"].engine) as db:
        audit = db.scalar(select(Audit).where(Audit.target == summary["B3"]))
        assert audit and audit.details == {
            "format": "xlsx",
            "pta_id": activity["pta_id"],
            "row_count": 1,
            "byte_size": len(response.content),
            "sha256": hashlib.sha256(response.content).hexdigest(),
            "as_of": summary["B6"],
        }


def test_excel_authorization_bounds_and_rollback(planning, auth_env, monkeypatch):
    from contextlib import ExitStack

    from sqlalchemy import event, select
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session
    from test_partner_portal import activity_partner, invite_partner

    from app.auth.models import Audit
    from app.planning import annual_export

    activity = approve_named(planning, "Rapport annuel")
    path = f"/api/v1/ptas/{activity['pta_id']}/exports"
    for role in ("agent", "supervisor", "validator"):
        assert excel(planning[role], activity["pta_id"]).status_code == 200
    assert excel(planning["admin"], activity["pta_id"]).status_code == 403
    assert planning["agent"].post(path, json={"format": "xlsx"}).status_code == 403
    assert excel(planning["agent"], "missing").status_code == 404
    assert (
        planning["agent"]
        .post(path, headers=headers(planning["agent"]), json={"format": "pdf"})
        .status_code
        == 422
    )
    schema = planning["agent"].get("/openapi.json").json()
    assert (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            "excel-denied@example.test",
        )
        assert excel(portal, activity["pta_id"]).status_code == 403
        assert (
            portal.post(
                f"/api/v1/partner-portal/ptas/{activity['pta_id']}/exports",
                headers=headers(portal),
                json={"format": "xlsx"},
            ).status_code
            == 422
        )

        portal.cookies.clear()
        assert (
            portal.post(
                path,
                headers={"Origin": "http://localhost", "X-CSRF-Token": "missing"},
                json={"format": "xlsx"},
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
    assert excel(planning["agent"], activity["pta_id"]).status_code == 422
    monkeypatch.undo()

    def fail(_connection, _cursor, statement, parameters, _context, _many):
        if "INSERT INTO auth_audit" in statement and "pta.export" in str(parameters):
            raise OperationalError(statement, parameters, Exception("synthetic"))

    event.listen(planning["auth"].engine, "before_cursor_execute", fail)
    try:
        response = excel(planning["agent"], activity["pta_id"])
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", fail)
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    assert audit_count() == before


def test_workbook_exact_integers_literal_text_and_layout():
    from app.planning.annual_report import workbook_artifact

    row = {
        "reference": "https://example.test",
        "name": '=HYPERLINK("https://example.test")',
        "revision": 1,
        "start": "2027-01-01",
        "end": "2027-12-31",
        "state": "Approuvée",
        "allocation": "9223372036854775807",
        "spending": 0,
        "reversement_amount": None,
    }
    content = workbook_artifact(
        (("Allocation approuvée XOF", "9223372036854775807"),), [row]
    )
    summary, cells = workbook_cells(content)
    assert summary["B3"] == "9223372036854775807"
    assert cells["G2"] == "9223372036854775807"
    assert cells["A2"] == "https://example.test"
    assert cells["B2"] == '=HYPERLINK("https://example.test")'
    assert cells["H2"] == "0"
    assert cells.get("I2", "") == ""
    with ZipFile(BytesIO(content)) as archive:
        root = ET.fromstring(archive.read("xl/worksheets/sheet2.xml"))
        assert root.find('.//s:c[@r="G2"]', NS).get("t") == "s"
        assert root.find(".//s:hyperlinks", NS) is None
        assert root.find("s:autoFilter", NS).get("ref") == "A1:I2"
        assert root.find(".//s:pane", NS).get("state") == "frozen"
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        assert [sheet.get("name") for sheet in workbook.find("s:sheets", NS)] == [
            "Synthèse",
            "Activités",
        ]
