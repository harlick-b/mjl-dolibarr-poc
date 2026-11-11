"""Printable annual working report, using the same facts/columns as Excel."""

from html import escape
from io import BytesIO
from typing import Any

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4, landscape  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    LongTable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.planning.reports.annual_report import COLUMNS


def pdf_artifact(
    metadata: tuple[tuple[str, object], ...], rows: list[dict[str, Any]]
) -> bytes:
    output = BytesIO()
    navy = colors.HexColor("#16324f")
    body = ParagraphStyle("AnnualBody", fontName="Helvetica", fontSize=8, leading=10)
    money = ParagraphStyle("AnnualMoney", parent=body, fontSize=7.5, alignment=2)
    header = ParagraphStyle("AnnualHeader", parent=body, textColor=colors.white)
    title = ParagraphStyle(
        "AnnualTitle",
        parent=body,
        fontSize=16,
        leading=20,
        textColor=navy,
        spaceAfter=12,
    )

    def cell(value: object, style: Any = body) -> Any:
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)

    def amount(value: object) -> str:
        return format(int(str(value)), ",").replace(",", " ")

    story = [cell("Rapport de travail — non officiel", title)]
    summary = [
        [cell(label), cell(amount(value) if label.endswith(" XOF") else value)]
        for label, value in metadata
    ]
    story.append(
        Table(
            summary,
            colWidths=[180, 599],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
        )
    )
    story.extend(
        [
            Spacer(1, 12),
            cell("Montants en XOF entiers. — : résultat non définitif ou sans objet."),
            Spacer(1, 8),
        ]
    )
    table_rows = [[cell(label, header) for label, _key in COLUMNS]]
    for row in rows:
        table_rows.append(
            [
                cell(
                    "—"
                    if row[key] is None
                    else amount(row[key])
                    if key in ("allocation", "spending", "reversement_amount")
                    else row[key],
                    money
                    if key in ("allocation", "spending", "reversement_amount")
                    else body,
                )
                for _label, key in COLUMNS
            ]
        )
    if rows:
        story.append(
            LongTable(
                table_rows,
                colWidths=[66, 180, 60, 60, 98, 105, 105, 105],
                repeatRows=1,
                splitInRow=1,
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), navy),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        (
                            "LINEBELOW",
                            (0, 0),
                            (-1, -1),
                            0.3,
                            colors.HexColor("#c8d0d5"),
                        ),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                ),
            )
        )
    else:
        story.append(cell("Aucune Activité approuvée dans ce PTA."))

    def footer(canvas: Any, document: Any) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(navy)
        canvas.drawString(30, 18, "MJL · Rapport de travail — non officiel")
        canvas.drawRightString(landscape(A4)[0] - 30, 18, f"Page {document.page}")
        canvas.restoreState()

    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=30,
        rightMargin=30,
        topMargin=28,
        bottomMargin=36,
        title="Rapport annuel de travail PTA",
        author="MJL",
    )
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
