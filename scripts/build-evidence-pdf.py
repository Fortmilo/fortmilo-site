from pathlib import Path
import re
import html
import unicodedata
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    ListFlowable,
    ListItem,
    Preformatted,
    HRFlowable,
)

SRC = Path("public/documents/evidence-semantics-and-scanner-orchestration.md")
OUT = Path("public/documents/evidence-semantics-and-scanner-orchestration.pdf")

REPLACEMENTS = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u00a0": " ",
    "\u2192": "->",
    "\u2190": "<-",
    "\u2265": ">=",
    "\u2264": "<=",
}


def ascii_text(value: str) -> str:
    for source, target in REPLACEMENTS.items():
        value = value.replace(source, target)
    return unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")


def inline_markup(value: str) -> str:
    value = html.escape(ascii_text(value.strip()), quote=False)
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    value = re.sub(r"_([^_]+)_", r"<i>\1</i>", value)
    value = re.sub(
        r"(https?://[^\s<]+)",
        lambda match: '<font name="Courier" size="7">' + match.group(1) + "</font>",
        value,
    )
    return value


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="DocumentTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        spaceAfter=14,
        textColor=colors.HexColor("#14213d"),
    )
)
styles.add(
    ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        spaceBefore=12,
        spaceAfter=7,
        textColor=colors.HexColor("#14213d"),
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="SubsectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=14,
        spaceBefore=8,
        spaceAfter=5,
        textColor=colors.HexColor("#243b53"),
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="DocumentBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.3,
        leading=13.2,
        spaceAfter=6,
        textColor=colors.HexColor("#1f2933"),
    )
)
styles.add(
    ParagraphStyle(
        name="DocumentQuote",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9.4,
        leading=13.2,
        leftIndent=12,
        rightIndent=10,
        borderPadding=6,
        backColor=colors.HexColor("#f0f4f8"),
        textColor=colors.HexColor("#102a43"),
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="TableCell",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=7.2,
        leading=9.0,
        spaceAfter=0,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHeader",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=7.2,
        leading=9.0,
        textColor=colors.white,
        spaceAfter=0,
    )
)
styles.add(
    ParagraphStyle(
        name="DocumentCode",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=7.8,
        leading=10.0,
        leftIndent=7,
        rightIndent=7,
        borderPadding=7,
        backColor=colors.HexColor("#f5f7fa"),
        textColor=colors.HexColor("#102a43"),
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="DocumentBullet",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.1,
        leading=12.4,
        spaceAfter=2,
    )
)

PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT = 18 * mm
RIGHT = 18 * mm
TOP = 18 * mm
BOTTOM = 17 * mm
FRAME = Frame(
    LEFT,
    BOTTOM,
    PAGE_WIDTH - LEFT - RIGHT,
    PAGE_HEIGHT - TOP - BOTTOM,
    id="normal",
)


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d9e2ec"))
    canvas.setLineWidth(0.4)
    canvas.line(LEFT, 12 * mm, PAGE_WIDTH - RIGHT, 12 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#627d98"))
    canvas.drawString(LEFT, 8 * mm, "FortMilo | Salesforce Security Observatory")
    canvas.drawRightString(PAGE_WIDTH - RIGHT, 8 * mm, str(document.page))
    canvas.restoreState()


document = BaseDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=LEFT,
    rightMargin=RIGHT,
    topMargin=TOP,
    bottomMargin=BOTTOM,
    title="Evidence Semantics and Scanner Orchestration",
    author="FortMilo",
    pageCompression=1,
)
document.addPageTemplates(PageTemplate(id="main", frames=FRAME, onPage=footer))

lines = SRC.read_text(encoding="utf-8").splitlines()
story = []
paragraph_lines = []


def flush_paragraph():
    if not paragraph_lines:
        return
    text = " ".join(line.strip() for line in paragraph_lines).strip()
    paragraph_lines.clear()
    if text:
        story.append(Paragraph(inline_markup(text), styles["DocumentBody"]))


def is_table_start(index):
    return (
        lines[index].strip().startswith("|")
        and index + 1 < len(lines)
        and re.match(r"^\s*\|?\s*:?-+", lines[index + 1])
    )


def parse_table(index):
    rows = []
    while index < len(lines) and lines[index].strip().startswith("|"):
        rows.append([cell.strip() for cell in lines[index].strip().strip("|").split("|")])
        index += 1

    if len(rows) >= 2 and all(re.match(r"^:?-+:?$", cell.replace(" ", "")) for cell in rows[1]):
        rows.pop(1)

    column_count = max(len(row) for row in rows)
    rows = [row + [""] * (column_count - len(row)) for row in rows]
    available_width = PAGE_WIDTH - LEFT - RIGHT
    lengths = [
        max(8, min(45, max(len(ascii_text(row[column])) for row in rows)))
        for column in range(column_count)
    ]
    widths = [available_width * length / sum(lengths) for length in lengths]
    minimum_width = 22 * mm if column_count <= 3 else 18 * mm
    widths = [max(minimum_width, width) for width in widths]
    scale = available_width / sum(widths)
    widths = [width * scale for width in widths]

    data = []
    for row_index, row in enumerate(rows):
        style = styles["TableHeader"] if row_index == 0 else styles["TableCell"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334e68")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#bcccdc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for row_index in range(1, len(data)):
        if row_index % 2 == 0:
            table_style.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#f7f9fb")))
    table.setStyle(TableStyle(table_style))
    story.append(table)
    story.append(Spacer(1, 7))
    return index


index = 0
while index < len(lines):
    raw = lines[index]
    stripped = raw.strip()

    if stripped.startswith("```"):
        flush_paragraph()
        index += 1
        code = []
        while index < len(lines) and not lines[index].strip().startswith("```"):
            code.append(ascii_text(lines[index]))
            index += 1
        story.append(Preformatted("\n".join(code), styles["DocumentCode"]))
        index += 1
        continue

    if is_table_start(index):
        flush_paragraph()
        index = parse_table(index)
        continue

    if not stripped:
        flush_paragraph()
        index += 1
        continue

    if stripped == "---":
        flush_paragraph()
        story.append(Spacer(1, 3))
        story.append(
            HRFlowable(
                width="55%",
                thickness=0.7,
                color=colors.HexColor("#9fb3c8"),
                spaceBefore=5,
                spaceAfter=8,
                hAlign="CENTER",
            )
        )
        index += 1
        continue

    if stripped.startswith("# "):
        flush_paragraph()
        story.append(Paragraph(inline_markup(stripped[2:]), styles["DocumentTitle"]))
        story.append(Spacer(1, 4))
        index += 1
        continue

    if stripped.startswith("## "):
        flush_paragraph()
        story.append(Paragraph(inline_markup(stripped[3:]), styles["SectionHeading"]))
        index += 1
        continue

    if stripped.startswith("### "):
        flush_paragraph()
        story.append(Paragraph(inline_markup(stripped[4:]), styles["SubsectionHeading"]))
        index += 1
        continue

    if stripped.startswith("> "):
        flush_paragraph()
        quote = []
        while index < len(lines) and lines[index].strip().startswith(">"):
            quote.append(lines[index].strip().lstrip(">").strip())
            index += 1
        story.append(Paragraph(inline_markup(" ".join(quote)), styles["DocumentQuote"]))
        continue

    if re.match(r"^[-*]\s+", stripped):
        flush_paragraph()
        items = []
        while index < len(lines) and re.match(r"^\s*[-*]\s+", lines[index].strip()):
            item = re.sub(r"^\s*[-*]\s+", "", lines[index].strip())
            items.append(ListItem(Paragraph(inline_markup(item), styles["DocumentBullet"]), leftIndent=10))
            index += 1
        story.append(
            ListFlowable(
                items,
                bulletType="bullet",
                start="circle",
                leftIndent=18,
                bulletFontName="Helvetica",
                bulletFontSize=6,
                spaceAfter=5,
            )
        )
        continue

    if re.match(r"^\d+\.\s+", stripped):
        flush_paragraph()
        items = []
        while index < len(lines) and re.match(r"^\s*\d+\.\s+", lines[index].strip()):
            item = re.sub(r"^\s*\d+\.\s+", "", lines[index].strip())
            items.append(ListItem(Paragraph(inline_markup(item), styles["DocumentBullet"]), leftIndent=12))
            index += 1
        story.append(
            ListFlowable(
                items,
                bulletType="1",
                leftIndent=20,
                bulletFontName="Helvetica",
                bulletFontSize=8,
                spaceAfter=5,
            )
        )
        continue

    paragraph_lines.append(raw)
    index += 1

flush_paragraph()
document.build(story)

# ReportLab adds an optional high-byte binary marker. Replace only those marker
# bytes with ASCII while preserving byte offsets and the PDF cross-reference.
pdf_bytes = OUT.read_bytes()
pdf_bytes = bytes(value if value < 128 else ord("#") for value in pdf_bytes)
OUT.write_bytes(pdf_bytes)

if any(value >= 128 for value in pdf_bytes) or b"\x00" in pdf_bytes:
    raise RuntimeError("Generated PDF is not ASCII-safe for repository publication")
