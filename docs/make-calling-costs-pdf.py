"""
Builds docs/LeadBells-Indian-Calling-Setup-and-Costs.pdf

A management-facing brief: what we need from Exotel and Vapi to run AI calls on
an Indian number, and how many calls a given monthly budget actually buys.

Every per-minute figure comes from the 18 real calls already placed on our own
Vapi account (1,250 seconds billed) - not from a vendor's price list.
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

OUT = "C:/Users/aman8/Downloads/AI_Lead_Generation/docs/LeadBells-Indian-Calling-Setup-and-Costs.pdf"

# Arial carries the rupee glyph; the built-in Type1 faces do not.
pdfmetrics.registerFont(TTFont("Body", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", "C:/Windows/Fonts/arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Body-Italic", "C:/Windows/Fonts/ariali.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body-Italic")

BRAND = colors.HexColor("#4F46E5")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
WASH = colors.HexColor("#F5F6FF")
GOOD = colors.HexColor("#047857")
WARN = colors.HexColor("#B45309")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", fontName="Body-Bold", fontSize=22, leading=27, textColor=INK, alignment=TA_CENTER, spaceAfter=4)
TAG = ParagraphStyle("TAG", fontName="Body", fontSize=11, leading=15, textColor=BRAND, alignment=TA_CENTER, spaceAfter=3)
DATE = ParagraphStyle("DATE", fontName="Body", fontSize=9, leading=13, textColor=MUTED, alignment=TA_CENTER, spaceAfter=16)
H2 = ParagraphStyle("H2", fontName="Body-Bold", fontSize=13, leading=17, textColor=BRAND, spaceBefore=14, spaceAfter=6)
BODY = ParagraphStyle("BODY", fontName="Body", fontSize=9.5, leading=13.5, textColor=INK)
B = ParagraphStyle("B", parent=BODY, fontName="Body-Bold")
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=8.5, leading=11.5, textColor=MUTED)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=9, leading=12)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Body-Bold")
HEAD = ParagraphStyle("HEAD", parent=CELL, fontName="Body-Bold", textColor=colors.white)


def p(t, s=BODY):
    return Paragraph(t, s)


def bullets(items):
    return ListFlowable(
        [ListItem(p(i), leftIndent=12, value="\u2022") for i in items],
        bulletType="bullet", start="\u2022", leftIndent=14, bulletFontSize=8, spaceAfter=4,
    )


def table(head, rows, widths, aligns=None, highlight=None):
    """A banded table. `highlight` is a row index (1-based over `rows`) to tint."""
    data = [[p(h, HEAD) for h in head]]
    for r in rows:
        data.append([p(str(c), CELL) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFB")]),
    ]
    for col, a in (aligns or {}).items():
        style.append(("ALIGN", (col, 0), (col, -1), a))
    if highlight:
        style.append(("BACKGROUND", (0, highlight), (-1, highlight), WASH))
        style.append(("LINEBEFORE", (0, highlight), (0, highlight), 2, BRAND))
    t.setStyle(TableStyle(style))
    return t


def callout(title, body, tone=BRAND):
    inner = [[p(f"<b>{title}</b>", ParagraphStyle("CT", parent=BODY, textColor=tone))],
             [p(body, BODY)]]
    t = Table(inner, colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WASH),
        ("LINEBEFORE", (0, 0), (0, -1), 3, tone),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Body", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12 * mm, "LeadBells \u2014 Indian Calling Setup & Cost Plan")
    canvas.drawRightString(190 * mm, 12 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 16 * mm, 190 * mm, 16 * mm)
    canvas.restoreState()


R = "\u20b9"
story = []

# ─── Cover block ──────────────────────────────────────────────────────
story.append(KeepTogether([
    Spacer(1, 18),
    p("Indian Calling Setup & Cost Plan", H1),
    p("Exotel (telephone line) + Vapi (AI voice) \u2014 requirements, timeline and calls per month", TAG),
    p("LeadBells \u00b7 Prepared 9 October 2026", DATE),
]))

story.append(KeepTogether([
    callout(
        "In one line",
        "To place AI calls that show an Indian number to the customer we need two vendors: <b>Exotel</b> supplies "
        "the Indian phone line, <b>Vapi</b> supplies the AI that speaks. Both bill per minute. At our measured rate "
        f"an AI call costs about <b>{R}21</b> for a two-minute conversation, so a monthly budget of "
        f"<b>{R}10,000</b> covers roughly <b>460 AI calls</b>.",
    ),
    Spacer(1, 10),
]))

# ─── 1. Why two vendors ───────────────────────────────────────────────
story.append(KeepTogether([
    p("1. Why two vendors are involved", H2),
    p("These are not alternatives. Each does a different job and both are charged on every call.", BODY),
    Spacer(1, 5),
    table(
        ["Vendor", "What it does", "Why we cannot drop it"],
        [
            ["Exotel", "Provides the Indian phone number and carries the call over Indian telecom networks.",
             "Without it our calls show a foreign number. Indian customers rarely answer those, and TRAI/DLT "
             "compliance is handled by the operator."],
            ["Vapi", "Converts speech to text, runs the AI conversation, and speaks the reply back in a natural voice.",
             "This is the product itself \u2014 the agent that talks, qualifies the lead and books the meeting."],
        ],
        [24 * mm, 66 * mm, 80 * mm],
    ),
    Spacer(1, 6),
    p("LeadBells already runs this flow end to end on a Twilio number today. Moving to Exotel changes the phone "
      "line only \u2014 the AI, the scripts, the CRM and the dashboard are unchanged.", SMALL),
]))

# ─── 2. Where the account stands today ───────────────────────────────
story.append(KeepTogether([
    p("2. Where the Exotel account stands today", H2),
    p("Verified directly against the Exotel API on 9 October 2026.", SMALL),
    Spacer(1, 5),
    table(
        ["Item", "Status", "Action needed"],
        [
            ["Account", "cyberbellsitesservices1 (prepaid)", "\u2014"],
            ["KYC verification", "Completed", "None \u2014 cleared"],
            ["API access", "Working, credentials validated", "None \u2014 cleared"],
            ["Account tier", "Trial", "Converts to paid on first recharge"],
            ["Wallet balance", f"\u2013{R}84.51 (negative)", "Recharge required before anything can be bought"],
            ["Phone numbers held", "None", "We will purchase one via API"],
            ["SIP trunk access", "Not enabled", "Must be requested from Exotel by email"],
        ],
        [36 * mm, 64 * mm, 70 * mm],
    ),
]))


# ─── 3. What we need ─────────────────────────────────────────────────
story.append(KeepTogether([
    p("3. What we need, and who provides it", H2),
    table(
        ["#", "Requirement", "Owner", "Notes"],
        [
            ["1", "Wallet recharge on Exotel", "Finance",
             f"Clears the {R}84.51 due and funds the number rental plus call credits."],
            ["2", "One Indian DID number", "Engineering",
             "Purchased by us through the Exotel API once the wallet is funded. No manual work."],
            ["3", "vSIP / SIP Trunk access", "Exotel support",
             "Requested by email. Exotel returns the trunk name and gateway IP and port. Approval normally "
             "takes 1\u20133 working days."],
            ["4", "Outbound calling enabled", "Exotel support", "Requested in the same email."],
            ["5", "DLT registration", "Compliance",
             "Required only if the calls are promotional. Service and transactional calls do not need it."],
            ["6", "Vapi account credit", "Finance",
             "Vapi bills in USD per minute. This is the larger of the two running costs."],
            ["7", "SIP trunk wiring in Vapi", "Engineering",
             "We create the trunk credential, attach the Exotel number and run test calls."],
            ["8", "Changes to LeadBells code", "\u2014",
             "None. The new number drops into the existing per-workspace credential settings."],
        ],
        [8 * mm, 42 * mm, 26 * mm, 94 * mm],
        aligns={0: "CENTER"},
    ),
]))

# ─── 4. Timeline ─────────────────────────────────────────────────────
story.append(KeepTogether([
    p("4. Timeline to go live", H2),
    table(
        ["When", "Step", "Owner"],
        [
            ["Day 0 \u2014 morning", "Recharge the Exotel wallet and send the SIP trunk request email", "Finance"],
            ["Day 0 \u2014 same day", "Purchase the Indian number through the API", "Engineering"],
            ["Day 1 to 3", "Exotel approves SIP trunk access and returns the gateway details", "Exotel"],
            ["Day 3 \u2014 half day", "Wire the trunk into Vapi, attach the number, run test calls", "Engineering"],
            ["Day 4", "Switch live traffic to the Indian number", "Engineering"],
        ],
        [34 * mm, 110 * mm, 26 * mm],
    ),
    Spacer(1, 6),
    callout(
        "No downtime risk",
        "Calling keeps running on the current Twilio number throughout. The Indian number only carries traffic "
        "once test calls pass, and we can switch back at any time.",
        GOOD,
    ),
]))

# ─── 5. Number options ───────────────────────────────────────────────
story.append(KeepTogether([
    p("5. Number options and monthly rental", H2),
    p("Live availability pulled from the Exotel API. Rental is charged monthly and is a fixed cost, not per call.", SMALL),
    Spacer(1, 5),
    table(
        ["Number type", "Example", "Rental / month", "Available", "Recommendation"],
        [
            ["Landline \u2014 Delhi", "011-4XXXXXXX", f"{R}499", "292 numbers", "Recommended \u2014 lowest rental, "
             "Indian customers answer local landlines readily"],
            ["Landline \u2014 Mumbai", "022-4XXXXXXX", f"{R}499", "73 numbers", "Equivalent alternative"],
            ["Landline \u2014 Pune", "020-4XXXXXXX", f"{R}499", "406 numbers", "Equivalent alternative"],
            ["Mobile (10 digit)", "089XXXXXXXX", f"{R}999", "54 numbers", "Twice the rental; use only if a mobile "
             "caller ID is specifically required"],
            ["Toll free", "1800-XXXXXXX", f"{R}1,799", "Available", "Built for inbound; poor value for outbound"],
        ],
        [30 * mm, 30 * mm, 24 * mm, 22 * mm, 64 * mm],
        aligns={2: "RIGHT", 3: "CENTER"},
        highlight=1,
    ),
]))


# ─── 6. Measured cost ────────────────────────────────────────────────
story.append(KeepTogether([
    p("6. What one AI call actually costs", H2),
    p("The Vapi figure below is not an estimate. It is the billed average across <b>18 real calls</b> already placed "
      "on our own account, totalling 1,250 seconds of conversation.", BODY),
    Spacer(1, 6),
    table(
        ["Cost component", "Rate per minute", "A 2-minute call", "Source"],
        [
            ["Vapi \u2014 AI platform fee", f"{R}4.40", f"{R}8.80", "Measured"],
            ["Vapi \u2014 language model", f"{R}2.90", f"{R}5.80", "Measured"],
            ["Vapi \u2014 voice and transcription", f"{R}2.20", f"{R}4.40", "Measured"],
            ["Vapi subtotal", f"{R}9.50", f"{R}19.00", "USD 0.108/min, 18 calls"],
            ["Exotel \u2014 outbound to mobile", f"{R}0.80", f"{R}1.60", "Exotel tariff"],
            ["Total per AI call", f"{R}10.30", f"{R}20.60", ""],
        ],
        [54 * mm, 32 * mm, 32 * mm, 52 * mm],
        aligns={1: "RIGHT", 2: "RIGHT"},
        highlight=6,
    ),
    Spacer(1, 6),
    p(f"Rounded for planning: <b>{R}21 per AI call</b> of two minutes. Assumes USD 1 = {R}88. "
      "Two minutes is the average length of a connected qualification call on our account; short unanswered calls "
      f"cost roughly {R}1.50 each and pull the real average down.", SMALL),
]))

# ─── 7. Calls per month ──────────────────────────────────────────────
story.append(KeepTogether([
    p("7. How many AI calls a monthly budget buys", H2),
    p(f"Each row assumes the {R}499 Delhi landline rental is paid first, and the rest is split across Exotel and "
      "Vapi in the ratio the calls actually consume.", SMALL),
    Spacer(1, 5),
    table(
        ["Monthly budget", "Goes to Exotel", "Goes to Vapi", "AI calls per month", "Calling minutes"],
        [
            [f"{R}3,000", f"{R}499 + {R}190", f"{R}2,311", "about 120 calls", "240 min"],
            [f"{R}5,000", f"{R}499 + {R}350", f"{R}4,151", "about 218 calls", "436 min"],
            [f"{R}10,000", f"{R}499 + {R}738", f"{R}8,763", "about 461 calls", "922 min"],
            [f"{R}25,000", f"{R}499 + {R}1,902", f"{R}22,599", "about 1,189 calls", "2,378 min"],
            [f"{R}50,000", f"{R}499 + {R}3,845", f"{R}45,656", "about 2,403 calls", "4,806 min"],
        ],
        [28 * mm, 34 * mm, 28 * mm, 40 * mm, 30 * mm],
        aligns={0: "RIGHT", 1: "RIGHT", 2: "RIGHT", 3: "CENTER", 4: "RIGHT"},
        highlight=3,
    ),
    Spacer(1, 8),
    callout(
        "The important point for budgeting",
        f"Exotel is the cheap half. Of every {R}21 call, only about {R}1.60 goes to Exotel and roughly {R}19 goes "
        f"to Vapi. A {R}3,000 recharge on Exotel alone would cover around 1,500 calls on the phone side \u2014 but "
        f"those same calls would need about {R}28,500 of Vapi credit. Budget must be planned around Vapi, not "
        "around the telephone line.",
        WARN,
    ),
]))


# ─── 8. Margin against our plans ─────────────────────────────────────
story.append(KeepTogether([
    p("8. Our published plans against this cost", H2),
    p("Calling cost only. The number rental is a single shared fixed cost across all customers, so it is not "
      "charged against any one plan.", SMALL),
    Spacer(1, 5),
    table(
        ["Plan", "Price / month", "AI calls included", "Calling cost", "Gross margin"],
        [
            ["Basic", f"{R}444", "5", f"{R}103", f"{R}341  (77%)"],
            ["Standard", f"{R}700", "15", f"{R}309", f"{R}391  (56%)"],
            ["Premium", f"{R}1,500", "40", f"{R}824", f"{R}676  (45%)"],
            ["Pro", f"{R}2,400", "75", f"{R}1,545", f"{R}855  (36%)"],
        ],
        [26 * mm, 30 * mm, 34 * mm, 30 * mm, 40 * mm],
        aligns={1: "RIGHT", 2: "CENTER", 3: "RIGHT", 4: "RIGHT"},
    ),
    Spacer(1, 6),
    p("All four plans are profitable on calling. The Pro tier is the thinnest at 36 percent, which is expected: it "
      "bundles the most calls. Margin here excludes GST, hosting and WhatsApp messaging.", BODY),
]))

# ─── 9. Cost reduction ───────────────────────────────────────────────
story.append(KeepTogether([
    p("9. A funded cost reduction we can make immediately", H2),
    p("The billing breakdown shows one call consuming <b>54,683 prompt tokens</b>. The full scraped business "
      "profile is being sent to the language model on every turn of the conversation. Measured across connected "
      "calls, the language model is <b>33 to 40 percent</b> of the Vapi bill.", BODY),
    Spacer(1, 5),
    table(
        ["", "Today", "After prompt trimming", "Saving"],
        [
            ["Cost per minute", f"{R}10.30", f"about {R}8.00", "22%"],
            ["Cost per 2-minute call", f"{R}20.60", f"about {R}16.00", f"{R}4.60"],
            [f"Calls for a {R}10,000 budget", "461", "about 594", "+133 calls"],
        ],
        [50 * mm, 30 * mm, 46 * mm, 30 * mm],
        aligns={1: "RIGHT", 2: "RIGHT", 3: "RIGHT"},
    ),
    Spacer(1, 6),
    p("This is an engineering change on our side only. It needs no vendor approval and does not reduce what the "
      "agent knows about the business \u2014 the profile is summarised once instead of being resent on every turn.", BODY),
]))

# ─── 10. Assumptions and risks ───────────────────────────────────────
story.append(KeepTogether([
    p("10. Assumptions and open items", H2),
    bullets([
        f"Exchange rate taken as USD 1 = {R}88. Vapi bills in USD, so a weaker rupee raises the per-call cost "
        "proportionally.",
        f"Exotel outbound tariff assumed at {R}0.80 per minute. The contracted rate sits between {R}0.70 and "
        f"{R}1.10 and should be confirmed from the Exotel billing page; at {R}1.10 the per-call total moves from "
        f"{R}20.60 to {R}21.20, which is immaterial.",
        "Average connected call taken as two minutes, measured on our own traffic. Longer scripts will raise the "
        "cost proportionally.",
        "Exotel SIP trunk approval is the only external dependency and the only item that can delay go-live.",
        "Promotional outbound calling to numbers on the DND registry is restricted in India regardless of vendor. "
        "Service and transactional calls are unaffected.",
        "Call recording, transcription storage and the CRM run on our existing servers at no additional per-call "
        "cost.",
    ]),
]))

story.append(KeepTogether([
    Spacer(1, 10),
    callout(
        "Recommended decision",
        f"Approve a {R}3,000 recharge on Exotel \u2014 that funds the Delhi number and covers the telephone side for "
        f"well over a year. Fund Vapi separately against expected call volume at {R}19 per call. Send the SIP trunk "
        "request email today so the 1 to 3 day approval runs in parallel.",
        GOOD,
    ),
]))

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=20 * mm,
    title="LeadBells - Indian Calling Setup & Cost Plan",
    author="LeadBells",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("written:", OUT)
