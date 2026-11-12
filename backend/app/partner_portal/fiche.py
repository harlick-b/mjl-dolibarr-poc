from __future__ import annotations

from typing import Any

from app.planning.reports.activity_fiche_pdf import render_activity_fiche


def xof(value: object | None) -> str:
    if value is None:
        return "—"
    return f"{int(str(value)):,}".replace(",", " ") + " F CFA"


def render_partner_fiche(detail: dict[str, Any], generated_at: str) -> bytes:
    finance = detail["finance"]
    initial_allocation = detail.get("initial_allocation", detail["allocation"])
    events = [
        {
            "date": row["decided_at"],
            "title": (
                "Programmation approuvée"
                if index == 0
                else "Transfert annuel approuvé"
                if row["kind"] == "transfer"
                else "Révision de programmation approuvée"
            ),
            "detail": (
                f"Budget autorisé : {xof(initial_allocation)}" if index == 0 else ""
            ),
        }
        for index, row in enumerate(detail["decisions"])
    ]
    if finance is not None:
        events.append(
            {
                "date": detail.get("fiche_realization_date") or finance["closed_at"],
                "title": "Réalisation validée",
                "detail": f"Dépenses effectuées : {xof(finance['final_spending'])}",
            }
        )
        if finance["reversement_amount"] is not None:
            events.append(
                {
                    "date": finance["reversement_date"],
                    "title": "Reversement enregistré",
                    "detail": f"Montant : {xof(finance['reversement_amount'])}",
                }
            )
        events.append(
            {
                "date": finance["closed_at"],
                "title": "Activité clôturée",
                "detail": "Solde régularisé",
            }
        )
    projection = {
        "reference": detail["reference"],
        "name": detail["name"],
        "subtitle": (
            f"Projet {detail['context']['project']} / "
            f"PTA {detail['context']['year']} / "
            f"Partenaire : {detail['context']['partner']}"
        ),
        "version": "partenaire",
        "programming": "Approuvée",
        "realization": detail.get(
            "fiche_realization", "Validée" if finance is not None else "Non commencée"
        ),
        "period_start": detail["planned_start"],
        "period_end": detail["planned_end"],
        "budget": detail.get("initial_allocation", detail["allocation"]),
        "authorized": detail["allocation"],
        "spent": finance["final_spending"] if finance is not None else None,
        "balance": str(
            int(finance["approved_allocation"]) - int(finance["final_spending"])
        )
        if finance is not None
        else None,
        "returned": finance["reversement_amount"] if finance is not None else None,
        "operations": [
            {
                "name": row["name"],
                "authorized": row["allocation"],
                "spent": row["final_spending"],
            }
            for row in detail["operations"]
        ],
        "requests": detail.get("fiche_requests", []),
        "events": events,
        "documents": detail.get("fiche_documents", []),
        "generated_at": generated_at,
    }
    return render_activity_fiche(projection)
