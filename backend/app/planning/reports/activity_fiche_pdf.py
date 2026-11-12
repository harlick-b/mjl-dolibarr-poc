from __future__ import annotations

from datetime import datetime
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_RIGHT  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle  # type: ignore[import-untyped]
from reportlab.pdfbase import pdfmetrics  # type: ignore[import-untyped]
from reportlab.pdfbase.ttfonts import TTFont  # type: ignore[import-untyped]
from reportlab.pdfgen import canvas  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#16324F")
BODY = colors.HexColor("#202529")
MUTED = colors.HexColor("#5C6870")
GREEN = colors.HexColor("#246A58")
RULE = colors.HexColor("#DBE2E8")
PALE = colors.HexColor("#F3F7F9")
WHITE = colors.white
PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT = 48
RIGHT = 48
CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT
FONT_DIR = Path(__file__).with_name("fonts")


def _register_fonts() -> None:
    if "DejaVuSans" in pdfmetrics.getRegisteredFontNames():
        return
    pdfmetrics.registerFont(TTFont("DejaVuSans", FONT_DIR / "DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", FONT_DIR / "DejaVuSans-Bold.ttf"))


def _safe(value: object | None) -> str:
    return "—" if value in (None, "") else escape(str(value)).replace("\n", "<br/>")


def _xof(value: object | None, *, suffix: bool = True) -> str:
    if value is None:
        return "—"
    rendered = f"{int(str(value)):,}".replace(",", " ")
    return f"{rendered} F CFA" if suffix else rendered


def _day(value: object | None) -> str:
    if not value:
        return "—"
    try:
        parsed = (
            value
            if isinstance(value, datetime)
            else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        )
    except ValueError:
        return _safe(value)
    months = (
        "jan.",
        "fév.",
        "mars",
        "avr.",
        "mai",
        "juin",
        "juil.",
        "août",
        "sept.",
        "oct.",
        "nov.",
        "déc.",
    )
    return f"{parsed.day:02d} {months[parsed.month - 1]} {parsed.year}"


def _short_day(value: object | None) -> str:
    rendered = _day(value)
    parts = rendered.split()
    return " ".join(parts[:2]) if len(parts) >= 2 else rendered


class _NumberedCanvas(canvas.Canvas):  # type: ignore[misc]
    def __init__(self, *args: Any, fiche: dict[str, Any], **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._fiche = fiche
        self._states: list[dict[str, Any]] = []

    def showPage(self) -> None:  # noqa: N802 - ReportLab API
        self._states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total = len(self._states)
        for state in self._states:
            self.__dict__.update(state)
            self._footer(total)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _footer(self, total: int) -> None:
        self.saveState()
        self.setStrokeColor(RULE)
        self.setLineWidth(0.5)
        self.line(LEFT, 48, PAGE_WIDTH - RIGHT, 48)
        self.setFont("DejaVuSans", 6.5)
        self.setFillColor(NAVY)
        self.drawString(LEFT, 35, "MJL / Fiche de suivi administratif et financier")
        generated = self._fiche["generated_at"]
        if isinstance(generated, str):
            generated = datetime.fromisoformat(generated.replace("Z", "+00:00"))
        stamp = generated.astimezone(ZoneInfo("Africa/Porto-Novo")).strftime(
            "Édité le %d/%m/%Y à %H:%M"
        )
        self.drawRightString(
            PAGE_WIDTH - RIGHT, 35, f"{stamp}  |  {self._pageNumber}/{total}"
        )
        self.restoreState()


def render_activity_fiche(fiche: dict[str, Any]) -> bytes:
    """Render the shared internal/Partner template from an audience-safe projection."""
    _register_fonts()
    buffer = BytesIO()
    body = ParagraphStyle(
        "body", fontName="DejaVuSans", fontSize=8, leading=11, textColor=BODY
    )
    small = ParagraphStyle(
        "small", parent=body, fontSize=8, leading=10, textColor=MUTED
    )
    label = ParagraphStyle(
        "label",
        parent=body,
        fontName="DejaVuSans-Bold",
        fontSize=7,
        leading=9,
        textColor=MUTED,
        splitLongWords=0,
    )
    label_right = ParagraphStyle("label-right", parent=label, alignment=TA_RIGHT)
    value = ParagraphStyle(
        "value",
        parent=body,
        fontName="DejaVuSans-Bold",
        fontSize=10.5,
        leading=13,
        textColor=NAVY,
    )
    activity_name = ParagraphStyle(
        "activity-name",
        parent=value,
        fontSize=12,
        leading=14,
    )
    financial_label = ParagraphStyle(
        "financial-label",
        parent=body,
        fontName="DejaVuSans",
        fontSize=8,
        leading=10,
        textColor=MUTED,
    )
    title = ParagraphStyle(
        "title",
        parent=body,
        fontName="DejaVuSans-Bold",
        fontSize=16,
        leading=19,
        spaceAfter=14,
        textColor=NAVY,
    )
    chronology_title = ParagraphStyle(
        "chronology-title", parent=title, fontSize=17, leading=21
    )
    event_title = ParagraphStyle(
        "event-title",
        parent=body,
        fontName="DejaVuSans-Bold",
        fontSize=9,
        leading=11,
        textColor=NAVY,
    )
    section_title = ParagraphStyle(
        "section-title",
        parent=event_title,
        fontSize=11,
        leading=13,
    )
    request_title = ParagraphStyle(
        "request-title",
        parent=event_title,
        fontSize=8.1,
        leading=10,
    )
    event_detail = ParagraphStyle(
        "event-detail",
        parent=small,
        leftIndent=CONTENT_WIDTH * 0.28,
        spaceBefore=3,
    )
    right = ParagraphStyle("right", parent=body, alignment=TA_RIGHT, textColor=NAVY)
    green_value = ParagraphStyle("green-value", parent=value, textColor=GREEN)
    green_right = ParagraphStyle(
        "green-right",
        parent=right,
        fontName="DejaVuSans-Bold",
        fontSize=8.1,
        textColor=GREEN,
    )
    version_style = ParagraphStyle(
        "version", parent=right, fontName="DejaVuSans-Bold", fontSize=8
    )

    def header(canv: Any, doc: Any) -> None:
        canv.saveState()
        canv.setFillColor(NAVY)
        canv.rect(0, PAGE_HEIGHT - 65, PAGE_WIDTH, 65, stroke=0, fill=1)
        canv.setFillColor(WHITE)
        canv.setFont("DejaVuSans-Bold", 19)
        canv.drawString(LEFT, PAGE_HEIGHT - 40, "MJL")
        if doc.page == 1:
            canv.setFont("DejaVuSans-Bold", 8)
            canv.drawRightString(
                PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 39, "SUIVI DES ACTIVITÉS"
            )
        else:
            canv.setFont("DejaVuSans-Bold", 8)
            canv.drawRightString(
                PAGE_WIDTH - RIGHT,
                PAGE_HEIGHT - 39,
                f"{fiche['reference']} / {fiche['version'].upper()}",
            )
        canv.restoreState()

    frame = Frame(
        LEFT,
        50,
        CONTENT_WIDTH,
        PAGE_HEIGHT - 126,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    document = BaseDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=76,
        bottomMargin=50,
        title=f"Fiche de suivi {fiche['reference']}",
        author="MJL",
        subject="Fiche de suivi administratif et financier de l’activité",
    )
    document.addPageTemplates(PageTemplate(id="fiche", frames=[frame], onPage=header))
    story: list[Any] = []

    story.extend(
        [
            Paragraph(
                "FICHE DE SUIVI ADMINISTRATIF<br/>ET FINANCIER DE L’ACTIVITÉ", title
            ),
            Table(
                [
                    [
                        Paragraph(_safe(fiche["reference"]), value),
                        Paragraph(f"VERSION {fiche['version'].upper()}", version_style),
                    ]
                ],
                colWidths=[CONTENT_WIDTH * 0.36, CONTENT_WIDTH * 0.64],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, 0), PALE),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            ),
            Spacer(1, 22),
            Paragraph(_safe(fiche["name"]), activity_name),
            Spacer(1, 9),
            Paragraph(_safe(fiche["subtitle"]), body),
            Spacer(1, 15.9),
        ]
    )

    def section(number: str, name: str, gap: float = 7) -> None:
        story.append(
            Table(
                [
                    [
                        Paragraph(f"<b>{number}</b>", section_title),
                        Paragraph(f"<b>{escape(name)}</b>", section_title),
                    ]
                ],
                colWidths=[29, CONTENT_WIDTH - 29],
                style=TableStyle(
                    [
                        ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                    ]
                ),
            )
        )
        story.append(Spacer(1, gap))

    section("01", "Situation de l’activité", 5.9)
    situation = [
        [
            Paragraph("PROGRAMMATION", label),
            Paragraph("RÉALISATION", label),
            Paragraph("PÉRIODE", label),
        ],
        [
            Paragraph(_safe(fiche["programming"]), green_value),
            Paragraph(_safe(fiche["realization"]), green_value),
            Paragraph(
                f"{_short_day(fiche['period_start'])} — "
                f"{_short_day(fiche['period_end'])}",
                value,
            ),
        ],
    ]
    story.append(
        Table(
            situation,
            colWidths=[
                167,
                162,
                CONTENT_WIDTH - 329,
            ],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), PALE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 14),
                    ("LEFTPADDING", (0, 0), (-1, -1), 13),
                ]
            ),
        )
    )
    story.append(Spacer(1, 14.1))

    section("02", "Synthèse financière", 6)
    financial = [
        [
            Paragraph("Budget prévisionnel", financial_label),
            Paragraph("Montant autorisé", financial_label),
            Paragraph("Montant dépensé", financial_label),
        ],
        [
            Paragraph(_xof(fiche["budget"]), value),
            Paragraph(_xof(fiche["authorized"]), value),
            Paragraph(_xof(fiche["spent"]), value),
        ],
    ]
    story.append(
        Table(
            financial,
            colWidths=[177, 177, CONTENT_WIDTH - 354],
            style=TableStyle(
                [
                    ("LINEBELOW", (0, -1), (-1, -1), 0.6, RULE),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 28),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ]
            ),
        )
    )
    story.append(
        Table(
            [
                [
                    Paragraph("Solde non dépensé", body),
                    Paragraph(_xof(fiche["balance"]), right),
                ],
                [
                    Paragraph("Montant reversé (enregistré)", body),
                    Paragraph(_xof(fiche["returned"]), green_right),
                ],
            ],
            colWidths=[CONTENT_WIDTH * 0.65, CONTENT_WIDTH * 0.35],
            style=TableStyle(
                [
                    ("FONTNAME", (1, 0), (1, -1), "DejaVuSans-Bold"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            ),
        )
    )
    story.append(Spacer(1, 12))

    section("03", "Opérations et dépenses", 2.3)
    operation_rows: list[list[Any]] = [
        [
            Paragraph("OPÉRATION", label),
            Paragraph("AUTORISÉ", label_right),
            Paragraph("DÉPENSÉ", label_right),
        ]
    ]
    operation_rows.extend(
        [
            Paragraph(_safe(row["name"]), body),
            Paragraph(
                _xof(row["authorized"], suffix=False).replace(" ", "&nbsp;"),
                right,
            ),
            Paragraph(_xof(row["spent"], suffix=False).replace(" ", "&nbsp;"), right),
        ]
        for row in fiche["operations"]
    )
    operation_rows.append(
        [
            Paragraph("<b>Total</b>", body),
            Paragraph(
                "<b>"
                + _xof(fiche["authorized"], suffix=False).replace(" ", "&nbsp;")
                + "</b>",
                right,
            ),
            Paragraph(
                "<b>"
                + _xof(fiche["spent"], suffix=False).replace(" ", "&nbsp;")
                + "</b>",
                right,
            ),
        ]
    )
    operation_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (1, 1), (1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 5.75),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5.75),
    ]
    operation_count = len(fiche["operations"])
    for row_index in range(1, operation_count + 1):
        top_padding = 18.04 if row_index == 1 else 13.4
        bottom_padding = 14.6 if row_index < operation_count else 13.4
        operation_style.extend(
            [
                (
                    "TOPPADDING",
                    (0, row_index),
                    (-1, row_index),
                    top_padding,
                ),
                (
                    "BOTTOMPADDING",
                    (0, row_index),
                    (-1, row_index),
                    bottom_padding,
                ),
            ]
        )
    total_index = operation_count + 1
    operation_style.extend(
        [
            ("TOPPADDING", (0, total_index), (-1, total_index), 13.37),
            ("BOTTOMPADDING", (0, total_index), (-1, total_index), 13.38),
        ]
    )
    story.append(
        Table(
            operation_rows,
            colWidths=[
                294.355,
                55.645,
                CONTENT_WIDTH - 350,
            ],
            repeatRows=1,
            splitByRow=1,
            style=TableStyle(operation_style),
        )
    )
    story.append(Spacer(1, 0))

    section("04", "Demandes de financement", 1.2)
    request_rows = fiche["requests"] or [
        {"date": None, "label": "Aucune demande enregistrée.", "state": ""}
    ]
    story.append(
        Table(
            [
                [
                    Paragraph(_day(row["date"]), small),
                    Paragraph(_safe(row["label"]), request_title),
                    Paragraph(_safe(row["state"]), green_right),
                ]
                for row in request_rows
            ],
            colWidths=[
                106,
                CONTENT_WIDTH - 106 - CONTENT_WIDTH * 0.22,
                CONTENT_WIDTH * 0.22,
            ],
            splitByRow=1,
            style=TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 9.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9.5),
                ]
            ),
        )
    )

    story.extend(
        [
            PageBreak(),
            Paragraph("Chronologie de l’activité", chronology_title),
            Paragraph(f"{_safe(fiche['reference'])} / {_safe(fiche['name'])}", body),
            Spacer(1, 24),
        ]
    )
    section("05", "Événements significatifs")
    events = fiche["events"] or [
        {"date": None, "title": "Aucun événement enregistré.", "detail": ""}
    ]
    for row in events:
        story.append(
            Table(
                [
                    [
                        Paragraph(_day(row["date"]), small),
                        Paragraph(_safe(row["title"]), event_title),
                    ]
                ],
                colWidths=[CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.72],
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            )
        )
        story.append(Paragraph(_safe(row.get("detail")), event_detail))
        story.append(Spacer(1, 10))

    section("06", "Pièces justificatives")
    documents = fiche["documents"] or [
        {"name": "Aucune pièce enregistrée.", "detail": ""}
    ]
    story.append(
        Table(
            [
                [
                    Paragraph(_safe(row["name"]), body),
                    Paragraph(_safe(row.get("detail")), right),
                ]
                for row in documents
            ],
            colWidths=[CONTENT_WIDTH * 0.64, CONTENT_WIDTH * 0.36],
            repeatRows=0,
            splitByRow=1,
            style=TableStyle(
                [
                    ("LINEBELOW", (0, 0), (-1, -1), 0.6, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ]
            ),
        )
    )

    document.build(
        story,
        canvasmaker=lambda *args, **kwargs: _NumberedCanvas(
            *args, fiche=fiche, **kwargs
        ),
    )
    return buffer.getvalue()
