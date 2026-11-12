import re
from datetime import datetime
from io import BytesIO

from pypdf import PdfReader

from app.planning.reports.activity_fiche_pdf import render_activity_fiche


def test_shared_fiche_template_continues_dynamic_content_and_numbers_pages():
    fiche = {
        "reference": "ACT-2026-001",
        "name": "Activité avec un contenu assez long pour vérifier la pagination",
        "subtitle": "Projet test / PTA 2026 / Partenaire : Partenaire test",
        "version": "interne",
        "programming": "Approuvée",
        "realization": "Validée",
        "period_start": "2026-01-01",
        "period_end": "2026-12-31",
        "budget": "9223372036854775807",
        "authorized": "9223372036854775807",
        "spent": "200000",
        "balance": "100000",
        "returned": "100000",
        "operations": [
            {
                "name": f"Opération {index} — description accentuée et détaillée",
                "authorized": "10000",
                "spent": "8000",
            }
            for index in range(30)
        ],
        "requests": [
            {
                "date": datetime.fromisoformat("2026-04-01T09:00:00+00:00"),
                "label": f"Demande financière {index}",
                "state": "Autorisée",
            }
            for index in range(15)
        ],
        "events": [
            {
                "date": "2026-05-01T10:00:00+00:00",
                "title": f"Événement administratif {index}",
                "detail": "Motif conservé dans la chronologie. " * 5,
            }
            for index in range(35)
        ],
        "documents": [
            {"name": f"Pièce justificative {index}.pdf", "detail": "01/06/2026"}
            for index in range(18)
        ],
        "generated_at": "2026-11-12T14:30:00+00:00",
    }

    document = render_activity_fiche(fiche)
    reader = PdfReader(BytesIO(document))
    assert len(reader.pages) >= 4
    extracted = [page.extract_text() or "" for page in reader.pages]
    assert "01" in extracted[0]
    assert "Situation de l’activité" in extracted[0]
    assert any("Événement administratif 34" in page for page in extracted)
    assert any("Pièce justificative 17.pdf" in page for page in extracted)
    normalized = re.sub(r"\s+", " ", " ".join(extracted))
    assert "01 avr." in normalized
    assert "01 mai" in normalized
    assert "apr." not in normalized
    assert "9 223 372 036 854 775 807 F CFA" in normalized
    total = len(reader.pages)
    for number, page in enumerate(extracted, start=1):
        assert f"{number}/{total}" in page
        assert "MJL / Fiche de suivi administratif et financier" in page
        if number > 1:
            assert "ACT-2026-001 / INTERNE" in page
