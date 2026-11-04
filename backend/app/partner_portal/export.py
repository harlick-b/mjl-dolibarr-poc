"""Allowlisted Partner CSV; internal annual-export metadata is never rendered."""

import csv
from io import StringIO
from typing import Any

from app.planning.annual_export import csv_cell, rate

# Explicit column list: future internal export additions are not shared implicitly.
COLUMNS = (
    ("Identifiant activité", "id"),
    ("Référence activité", "reference"),
    ("Nom activité", "name"),
    ("Révision approuvée", "revision"),
    ("Début approuvé", "start"),
    ("Fin approuvée", "end"),
    ("État", "state"),
    ("Allocation approuvée XOF", "allocation"),
    ("Dépense finale XOF", "spending"),
    ("Virement externe confirmé XOF", "confirmation_amount"),
    ("Date du virement externe", "confirmation_date"),
    ("Surplus à reverser XOF", "reversement_required"),
    ("Reversement enregistré XOF", "reversement_amount"),
    ("Date du reversement", "reversement_date"),
    ("Date de clôture UTC", "closed_at"),
)


def artifact(
    *,
    export_id: str,
    partner_name: str,
    project_reference: str,
    project_name: str,
    year: int,
    metrics: dict[str, Any],
    rows: list[dict[str, Any]],
) -> bytes:
    output = StringIO(newline="")
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    physical, financial = metrics["physical"], metrics["financial"]
    metadata = (
        ("Identifiant export", export_id),
        ("Données capturées UTC", metrics["as_of"]),
        ("Partenaire", partner_name),
        ("Référence projet", project_reference),
        ("Projet", project_name),
        ("Exercice", year),
        ("Activités clôturées", physical["closed_activities"]),
        ("Activités approuvées", physical["approved_activities"]),
        (
            "Exécution physique",
            rate(physical["closed_activities"], physical["approved_activities"]),
        ),
        ("Dépenses finales clôturées XOF", financial["closed_spending"]),
        ("Allocation approuvée XOF", financial["approved_allocation"]),
        (
            "Exécution financière",
            rate(
                int(financial["closed_spending"]), int(financial["approved_allocation"])
            ),
        ),
    )
    writer.writerows((csv_cell(key), csv_cell(value)) for key, value in metadata)
    writer.writerow(())
    writer.writerow([label for label, _key in COLUMNS])
    for row in rows:
        public = {key: row[key] for _label, key in COLUMNS}
        public["state"] = "Clôturée" if row["closed_at"] else "Approuvée"
        writer.writerow([csv_cell(public[key]) for _label, key in COLUMNS])
    return ("\ufeff" + output.getvalue()).encode("utf-8")
