"""Current-PTA Excel working report; facts come from the annual export snapshot."""

from io import BytesIO
from typing import Any

from xlsxwriter import Workbook  # type: ignore[import-untyped]

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
COLUMNS = (
    ("Référence activité", "reference"),
    ("Nom activité", "name"),
    ("Début approuvé", "start"),
    ("Fin approuvée", "end"),
    ("État actuel", "state"),
    ("Budget approuvé XOF", "allocation"),
    ("Dépense finale XOF", "spending"),
    ("Surplus reversé XOF", "reversement_amount"),
)
NUMERIC_KEYS = {"allocation", "spending", "reversement_amount"}


def workbook_artifact(
    metadata: tuple[tuple[str, object], ...], rows: list[dict[str, Any]]
) -> bytes:
    output = BytesIO()
    with Workbook(
        output,
        {"in_memory": True, "strings_to_formulas": False, "strings_to_urls": False},
    ) as workbook:
        workbook.set_properties({"title": "Rapport de travail PTA", "author": "MJL"})
        title = workbook.add_format(
            {"bold": True, "font_size": 14, "font_color": "#16324f"}
        )
        header = workbook.add_format(
            {
                "bold": True,
                "bg_color": "#16324f",
                "font_color": "#ffffff",
                "text_wrap": True,
            }
        )
        number = workbook.add_format({"num_format": "#,##0"})
        summary = workbook.add_worksheet("Synthèse")
        summary.set_column(0, 0, 35)
        summary.set_column(1, 1, 65)
        summary.write_string(0, 0, "Rapport de travail — non officiel", title)
        for row_number, (label, value) in enumerate(metadata, 2):
            summary.write_string(row_number, 0, label)
            # Counts and integer XOF remain usable in Excel within its exact range.
            if label.endswith(" XOF") or label in (
                "Exercice",
                "Activités clôturées",
                "Activités approuvées",
            ):
                integer = int(str(value))
                if abs(integer) <= 999_999_999_999_999:
                    summary.write_number(row_number, 1, integer, number)
                else:
                    summary.write_string(row_number, 1, str(integer))
            else:
                summary.write_string(row_number, 1, str(value))
        summary.write_string(
            len(metadata) + 3,
            0,
            "Montants XOF entiers ; au-delà de 15 chiffres, texte exact.",
        )
        summary.write_string(
            len(metadata) + 4,
            0,
            "Cellule financière vide : résultat non définitif ou sans objet.",
        )
        activities = workbook.add_worksheet("Activités")
        activities.freeze_panes(1, 0)
        activities.set_column(0, 0, 23)
        activities.set_column(1, 1, 48)
        activities.set_column(2, 4, 18)
        activities.set_column(5, 5, 30)
        activities.set_column(6, 8, 24, number)
        activities.set_row(0, 32)
        for col, (label, _key) in enumerate(COLUMNS):
            activities.write_string(0, col, label, header)
        for row_number, row in enumerate(rows, 1):
            for col, (_label, key) in enumerate(COLUMNS):
                value = row[key]
                if value is None:
                    continue
                if key in NUMERIC_KEYS and abs(int(value)) <= 999_999_999_999_999:
                    activities.write_number(row_number, col, int(value), number)
                else:
                    activities.write_string(row_number, col, str(value))
        activities.autofilter(0, 0, len(rows), len(COLUMNS) - 1)
    return output.getvalue()
