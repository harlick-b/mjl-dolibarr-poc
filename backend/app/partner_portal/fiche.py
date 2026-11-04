from __future__ import annotations

from html import escape
from io import BytesIO
from typing import Any

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_CENTER  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import-untyped]
from reportlab.lib.units import mm  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#102A43")
PALE = colors.HexColor("#F3F6F8")


def safe(value: object | None) -> str:
    return "—" if value in (None, "") else escape(str(value)).replace("\n", "<br/>")


def day(value: object | None) -> str:
    if not isinstance(value, str) or not value:
        return "—"
    year, month, day_value = value[:10].split("-")
    return f"{day_value}/{month}/{year}"


def xof(value: object | None) -> str:
    if value is None:
        return "—"
    return f"{int(str(value)):,}".replace(",", " ") + " F CFA"


def render_partner_fiche(detail: dict[str, Any], generated_at: str) -> bytes:
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="PartnerTitle",
            parent=styles["Title"],
            textColor=NAVY,
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PartnerSection",
            parent=styles["Heading2"],
            textColor=NAVY,
            fontSize=12,
            leading=15,
            spaceBefore=5 * mm,
            spaceAfter=2 * mm,
        )
    )
    small = styles["BodyText"]
    story: list[Any] = [
        Paragraph("FICHE PARTENAIRE D’ACTIVITÉ", styles["PartnerTitle"]),
        Paragraph(
            f"{safe(detail['reference'])} · {safe(detail['name'])}",
            styles["Heading2"],
        ),
        Paragraph(
            "Synthèse en lecture seule des faits approuvés partageables "
            "avec le Partenaire.",
            small,
        ),
        Spacer(1, 3 * mm),
    ]

    def section(title: str) -> None:
        story.append(Paragraph(title, styles["PartnerSection"]))

    def facts(rows: list[tuple[str, str]]) -> None:
        table = Table(
            [
                [Paragraph(f"<b>{label}</b>", small), Paragraph(value, small)]
                for label, value in rows
            ],
            colWidths=[50 * mm, 120 * mm],
            splitInRow=1,
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), PALE),
                    ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)

    context = detail["context"]
    section("1. Contexte")
    facts(
        [
            ("Partenaire", safe(context["partner"])),
            (
                "Projet",
                f"{safe(context['project_reference'])} · {safe(context['project'])}",
            ),
            ("PTA", str(context["year"])),
            ("État", "Clôturée" if detail["state"] == "closed" else "Approuvée"),
            ("Générée le", day(generated_at)),
        ]
    )

    section("2. Planification approuvée")
    facts(
        [
            ("Description", safe(detail["description"])),
            (
                "Période",
                f"{day(detail['planned_start'])} au {day(detail['planned_end'])}",
            ),
            ("Allocation approuvée", xof(detail["allocation"])),
            ("Révision approuvée", f"N° {detail['approved_revision']}"),
        ]
    )
    operation_rows: list[tuple[Any, str, str]] = [
        ("Opération", "Prévu", "Dépense finale")
    ]
    operation_rows.extend(
        (
            Paragraph(safe(row["name"]), small),
            xof(row["allocation"]),
            xof(row["final_spending"]),
        )
        for row in detail["operations"]
    )
    operation_table = Table(
        operation_rows,
        colWidths=[100 * mm, 35 * mm, 35 * mm],
        splitInRow=1,
        repeatRows=1,
    )
    operation_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(operation_table)

    labels = {
        "initial": "Approbation initiale",
        "amendment": "Modification approuvée",
        "transfer": "Transfert annuel approuvé",
    }
    section("3. Décisions finales")
    facts(
        [
            (
                labels.get(item["kind"], "Décision approuvée"),
                f"Révision {item['revision']} · {day(item['decided_at'])}",
            )
            for item in detail["decisions"]
        ]
        or [("Situation", "Aucune décision finale disponible.")]
    )

    section("4. Résultat financier définitif")
    finance = detail["finance"]
    if finance is None:
        facts([("Situation", "Disponible après la clôture de l’Activité.")])
    else:
        facts(
            [
                ("Allocation approuvée", xof(finance["approved_allocation"])),
                ("Dépense finale", xof(finance["final_spending"])),
                (
                    "Dépense nulle validée",
                    "Oui" if finance["zero_spending"] else "Non",
                ),
                (
                    "Virement externe confirmé",
                    f"{xof(finance['confirmed_transfer_amount'])} · "
                    f"{day(finance['confirmed_transfer_date'])}",
                ),
                ("Surplus à reverser", xof(finance["reversement_required"])),
                (
                    "Reversement enregistré",
                    f"{xof(finance['reversement_amount'])} · "
                    f"{day(finance['reversement_date'])}",
                ),
                ("Activité clôturée le", day(finance["closed_at"])),
            ]
        )

    def decorate(canvas: Any, document: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(20 * mm, 10 * mm, f"MJL · {detail['reference']}")
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title=f"Fiche Partenaire {detail['reference']}",
        author="MJL",
        subject="Fiche Partenaire d’Activité",
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()
