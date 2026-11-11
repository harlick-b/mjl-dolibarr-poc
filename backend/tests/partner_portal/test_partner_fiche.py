from io import BytesIO

from pypdf import PdfReader

from app.partner_portal.fiche import render_partner_fiche


def detail():
    return {
        "reference": "ACT-TEST",
        "name": "Activité synthétique",
        "context": {
            "partner": "Partenaire test",
            "project_reference": "PRJ-TEST",
            "project": "Projet test",
            "year": 2027,
        },
        "state": "approved",
        "description": "Description test",
        "planned_start": "2027-01-01",
        "planned_end": "2027-12-31",
        "allocation": 100,
        "approved_revision": 1,
        "operations": [
            {"name": "Opération", "allocation": 100, "final_spending": None}
        ],
        "decisions": [],
        "finance": None,
    }


def test_multiline_description_continues_across_pages():
    activity = detail()
    activity["description"] = "Ligne de description\n" * 189 + "FIN DESCRIPTION"
    assert len(activity["description"]) <= 4000
    pdf = PdfReader(BytesIO(render_partner_fiche(activity, "2027-01-01")))
    content = "\n".join(page.extract_text() for page in pdf.pages)
    assert "Révision" not in content
    assert len(pdf.pages) > 1
    assert content.count("Ligne de description") == 189
    assert "FIN DESCRIPTION" in content
    assert "Résultat financier définitif" in content


def test_operation_names_wrap_and_preserve_special_characters():
    activity = detail()
    activity["operations"] = [
        {
            "name": "Recherche & développement <local>",
            "allocation": 100,
            "final_spending": None,
        },
        {"name": "W" * 200, "allocation": 200, "final_spending": None},
    ]
    pdf = PdfReader(BytesIO(render_partner_fiche(activity, "2027-01-01")))
    content = "\n".join(page.extract_text() for page in pdf.pages)
    assert "Recherche & développement <local>" in content
    name_lines = [
        line.strip() for line in content.splitlines() if line.strip().startswith("W")
    ]
    assert "".join(name_lines) == "W" * 200
    # At 10pt, at most 28 wide 'W' glyphs fit the 100mm text column.
    assert all(len(line) <= 28 for line in name_lines)
    assert "200 F CFA" in content
