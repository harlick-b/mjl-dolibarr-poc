import re
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


def test_template_uses_the_six_approved_sections_and_excludes_description():
    activity = detail()
    activity["description"] = "Ligne de description\n" * 189 + "FIN DESCRIPTION"
    assert len(activity["description"]) <= 4000
    pdf = PdfReader(BytesIO(render_partner_fiche(activity, "2027-01-01")))
    content = "\n".join(page.extract_text() for page in pdf.pages)
    assert "Révision" not in content
    assert len(pdf.pages) == 2
    assert "Ligne de description" not in content
    for section in (
        "Situation de l’activité",
        "Synthèse financière",
        "Opérations et dépenses",
        "Demandes de financement",
        "Événements significatifs",
        "Pièces justificatives",
    ):
        assert section in content


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
    assert all(len(line) <= 40 for line in name_lines)
    assert "200" in content


def test_closed_partner_fiche_uses_shareable_approved_milestones_only():
    activity = detail()
    activity.update(
        {
            "allocation": "125",
            "initial_allocation": "100",
            "decisions": [
                {
                    "kind": "initial",
                    "revision": 1,
                    "decided_at": "2027-01-10T10:00:00+00:00",
                }
            ],
            "finance": {
                "approved_allocation": "125",
                "final_spending": "100",
                "zero_spending": False,
                "confirmed_transfer_amount": "100",
                "confirmed_transfer_date": "2027-11-01",
                "reversement_required": "25",
                "reversement_amount": "25",
                "reversement_date": "2027-11-12",
                "closed_at": "2027-11-20T10:00:00+00:00",
            },
            "fiche_realization_date": "2027-11-05T10:00:00+00:00",
            "fiche_requests": [
                {
                    "date": "2027-10-01T10:00:00+00:00",
                    "label": "Décaissement de 100 F CFA",
                    "state": "Autorisée",
                }
            ],
        }
    )
    activity["operations"][0]["final_spending"] = "100"

    pdf = PdfReader(BytesIO(render_partner_fiche(activity, "2027-12-01")))
    content = "\n".join(page.extract_text() for page in pdf.pages)
    assert re.search(
        r"Budget prévisionnel.*Montant autorisé.*100 F CFA.*125 F CFA",
        content,
        re.DOTALL,
    )
    assert "05 nov. 2027" in content
    assert "20 nov. 2027\nRéalisation validée" not in content
    assert "Décaissement de 100 F CFA" in content
    assert "Description test" not in content
