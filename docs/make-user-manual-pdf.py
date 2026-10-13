"""
Builds docs/LeadBells-User-Manual.pdf

The customer-facing manual: every screen of the web console, in the order a new
workspace meets them, with a screenshot of the real product on each page.

Screenshots come from docs/manual-shots/ - captured from a running workspace, so
the numbers, leads and call summaries in them are real rather than mocked up.
"""
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, Image, KeepTogether, ListFlowable, ListItem, NextPageTemplate,
                                PageBreak, PageTemplate, Paragraph, BaseDocTemplate, Frame, Spacer, Table,
                                TableStyle)

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "manual-shots")
OUT = os.path.join(HERE, "LeadBells-User-Manual.pdf")

# Arial carries the rupee glyph and the arrows; the built-in Type1 faces do not.
pdfmetrics.registerFont(TTFont("Body", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", "C:/Windows/Fonts/arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Body-Italic", "C:/Windows/Fonts/ariali.ttf"))
pdfmetrics.registerFont(TTFont("Mono", "C:/Windows/Fonts/consola.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body-Italic")

BRAND = colors.HexColor("#4F46E5")
BRAND_STRONG = colors.HexColor("#4338CA")
BRAND_SOFT = colors.HexColor("#EEF2FF")
INK = colors.HexColor("#0F172A")
TEXT = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#E2E8F0")
GROUND = colors.HexColor("#F8FAFC")
NOTE = colors.HexColor("#F5F3FF")
GOOD = colors.HexColor("#047857")

PAGE_W, PAGE_H = A4
MARGIN = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

S = dict(
    cover_title=ParagraphStyle("ct", fontName="Body-Bold", fontSize=34, leading=40, textColor=INK,
                               alignment=TA_CENTER, spaceAfter=8),
    cover_sub=ParagraphStyle("cs", fontName="Body", fontSize=13, leading=18, textColor=BRAND,
                             alignment=TA_CENTER, spaceAfter=6),
    cover_meta=ParagraphStyle("cm", fontName="Body", fontSize=10, leading=15, textColor=MUTED,
                              alignment=TA_CENTER),
    part=ParagraphStyle("pt", fontName="Body-Bold", fontSize=11, leading=14, textColor=BRAND_STRONG,
                        spaceBefore=0, spaceAfter=2),
    eyebrow=ParagraphStyle("eb", fontName="Body-Bold", fontSize=7.8, leading=11, textColor=MUTED, spaceAfter=2),
    h=ParagraphStyle("h", fontName="Body-Bold", fontSize=18, leading=22, textColor=INK, spaceAfter=3),
    summary=ParagraphStyle("sm", fontName="Body", fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=8),
    body=ParagraphStyle("bd", fontName="Body", fontSize=9.5, leading=14, textColor=TEXT, spaceAfter=5),
    sub=ParagraphStyle("sb", fontName="Body-Bold", fontSize=11, leading=15, textColor=INK,
                       spaceBefore=8, spaceAfter=3),
    cell=ParagraphStyle("cl", fontName="Body", fontSize=8.8, leading=12, textColor=TEXT),
    head=ParagraphStyle("hd", fontName="Body-Bold", fontSize=8.8, leading=12, textColor=colors.white),
    cap=ParagraphStyle("cp", fontName="Body-Italic", fontSize=8, leading=11, textColor=MUTED, spaceBefore=3),
    toc=ParagraphStyle("tc", fontName="Body", fontSize=9.2, leading=14, textColor=TEXT),
    toc_part=ParagraphStyle("tp", fontName="Body-Bold", fontSize=9, leading=16, textColor=BRAND_STRONG,
                            spaceBefore=8),
)


def p(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items, numbered=False):
    return ListFlowable(
        [ListItem(p(i), leftIndent=11, value=(i + 1) if numbered else "\u2022") for i, i_ in enumerate(items)]
        if False else
        [ListItem(p(it), leftIndent=11) for it in items],
        bulletType="1" if numbered else "bullet",
        start="1" if numbered else "\u2022",
        leftIndent=14, bulletFontName="Body-Bold", bulletFontSize=8.5,
        bulletColor=BRAND, spaceBefore=1, spaceAfter=5,
    )


def table(head, rows, widths):
    data = [[p(h, "head") for h in head]] + [[p(str(c), "cell") for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GROUND]),
    ]))
    return t


def tip(text, label="Tip", tone=BRAND):
    inner = [[p(f'<font color="#{tone.hexval()[2:]}"><b>{label}</b></font>  {text}', "cell")]]
    t = Table(inner, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NOTE),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, tone),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def shot(name, caption):
    """A screenshot, scaled to the text column, with a thin frame and a caption."""
    path = os.path.join(SHOTS, name)
    iw, ih = ImageReader(path).getSize()
    w = CONTENT_W * 0.78
    img = Image(path, width=w, height=ih * w / iw)
    img.hAlign = "CENTER"
    frame = Table([[img]], colWidths=[w])
    frame.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [Spacer(1, 6), frame, p(caption, "cap"), Spacer(1, 4)]


# ─── Page furniture ───────────────────────────────────────────────────

def chrome(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, PAGE_H - MARGIN + 6 * mm, PAGE_W - MARGIN, PAGE_H - MARGIN + 6 * mm)
    canvas.setFont("Body-Bold", 8)
    canvas.setFillColor(BRAND)
    canvas.drawString(MARGIN, PAGE_H - MARGIN + 8.5 * mm, "LeadBells")
    canvas.setFont("Body", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 8.5 * mm, "User Manual")
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.drawString(MARGIN, 10 * mm, "AI Leads Follow up, tracking & calling software")
    canvas.drawRightString(PAGE_W - MARGIN, 10 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


def cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BRAND_SOFT)
    canvas.rect(0, PAGE_H - 92 * mm, PAGE_W, 92 * mm, stroke=0, fill=1)
    canvas.setFillColor(BRAND)
    canvas.rect(0, PAGE_H - 92 * mm, PAGE_W, 2.5 * mm, stroke=0, fill=1)
    canvas.setFont("Body", 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, 14 * mm, "Cyberbells ITES Services Pvt Ltd  \u00b7  leadbells.com")
    canvas.restoreState()


# ─── The manual ───────────────────────────────────────────────────────
# (part, title, chip, summary, builder) - builder returns the body flowables.

R = "\u20b9"
A = "\u2192"
story = []

# Cover
story += [
    Spacer(1, 42 * mm),
    p("LeadBells", "cover_title"),
    p("User Manual", "cover_sub"),
    Spacer(1, 30 * mm),
    p("AI Leads Follow up, tracking &amp; calling software", "cover_sub"),
    Spacer(1, 4),
    p("Every screen of the web console, in the order you meet them,<br/>"
      "with screenshots taken from a working workspace.", "cover_meta"),
    Spacer(1, 10),
    p("Version 1.0  \u00b7  13 October 2026", "cover_meta"),
    NextPageTemplate("body"),
    PageBreak(),
]

# Contents
CONTENTS = [
    ("Part 1 \u2014 Getting started", [
        "1. What LeadBells is, and who sees what",
        "2. Create your workspace",
        "3. Sign in",
        "4. Your home screen",
    ]),
    ("Part 2 \u2014 Working the pipeline", [
        "5. Leads",
        "6. Inside a lead",
        "7. Follow-up tasks",
        "8. Lead scoring",
    ]),
    ("Part 3 \u2014 The AI on the phone", [
        "9. Set up the calling agent",
        "10. Calls: recordings, transcripts and outcomes",
        "11. Handoffs",
    ]),
    ("Part 4 \u2014 WhatsApp and chat", [
        "12. Two-way WhatsApp AI",
        "13. Conversations",
        "14. Bookings and payment links",
    ]),
    ("Part 5 \u2014 Meetings", [
        "15. Appointments and Google Calendar",
    ]),
    ("Part 6 \u2014 Teaching the AI", [
        "16. Chat agents and the website widget",
        "17. Knowledge base",
        "18. AI Automation: find new prospects",
        "19. Leads Scrap AI",
    ]),
    ("Part 7 \u2014 Insights", [
        "20. Analytics",
        "21. Notifications",
    ]),
    ("Part 8 \u2014 Your workspace", [
        "22. Your team and their roles",
        "23. Plan and billing",
        "24. Organization settings",
        "25. API credentials: use your own keys",
        "26. Integrations, webhooks and the API",
    ]),
    ("Part 9 \u2014 Help", [
        "27. Support tickets",
        "28. Questions people ask",
    ]),
]

story += [p("Contents", "h"), Spacer(1, 4)]
left, right = [], []
flat = []
for part, items in CONTENTS:
    flat.append((part, None))
    for it in items:
        flat.append((None, it))
half = (len(flat) + 1) // 2
for i, (part, item) in enumerate(flat):
    target = left if i < half else right
    target.append(p(part, "toc_part") if part else p(item, "toc"))
toc = Table([[left, right]], colWidths=[CONTENT_W / 2 - 4 * mm, CONTENT_W / 2 - 4 * mm])
toc.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
story += [toc, PageBreak()]


def article(part, n, title, chip, summary, body, image=None, caption=None, newpage=True):
    """One manual section: heading block, prose, then its screenshot."""
    out = []
    # "Part 7 - Insights - Insights" reads like a stutter; drop the chip when the
    # part already names it.
    eyebrow = part.upper() if chip.lower() in part.lower() else f"{part.upper()}  \u00b7  {chip.upper()}"
    head = [
        p(eyebrow, "eyebrow"),
        p(f"{n}. {title}", "h"),
        p(summary, "summary"),
    ]
    out.append(KeepTogether(head + body[:1]))
    out += body[1:]
    if image:
        out.append(CondPageBreak(96 * mm))
        out += shot(image, caption)
    if newpage:
        out.append(PageBreak())
    return out


# ── Part 1 ────────────────────────────────────────────────────────────
story += article(
    "Part 1 \u2014 Getting started", 1, "What LeadBells is, and who sees what", "Overview",
    "One workspace where the leads arrive, the AI calls and messages them, and your team closes them.",
    [
        p("LeadBells captures a lead from your website, a WhatsApp message, an import or your own team, then "
          "works it without anyone having to remember to. The AI calls the lead, understands what they want, "
          "writes the summary, books the meeting, sends the WhatsApp follow-up and leaves your salesperson a "
          "task with the next step already decided."),
        p("Everything runs in one browser, at your own workspace address. There is nothing to install.", "body"),
        p("Who can do what", "sub"),
        p("Every person you add has one role, and the role decides which menus they see and what they may change.",
          "body"),
        table(
            ["Role", "What they can do"],
            [
                ["<b>Admin</b>", "Everything in the workspace: settings, team, AI configuration, billing, API keys, "
                                 "and the whole pipeline."],
                ["<b>Sales manager</b>", "The full pipeline and the team's work, reports and appointments. Not "
                                         "billing or API keys."],
                ["<b>Salesperson</b>", "Their own leads, calls, conversations, tasks and appointments."],
                ["<b>Viewer</b>", "Read-only. Sees leads, pipeline and appointments but <b>never a lead's e-mail "
                                  "or phone number</b> \u2014 those show as \u201cHidden\u201d. Cannot add, edit, "
                                  "delete or export."],
            ],
            [30 * mm, CONTENT_W - 30 * mm],
        ),
        Spacer(1, 6),
        tip("If a menu you expect is missing, your role does not include it. Ask your administrator rather than "
            "sharing a login \u2014 every action is recorded against the person who did it."),
        p("What the AI does on its own", "sub"),
        bullets([
            "Calls a new lead \u2014 how soon depends on how hot the lead is.",
            "Listens, answers from your own material, and decides the next step.",
            "Books the meeting into the calendar and sends the invite.",
            "Sends a personalised WhatsApp after the call, and answers when the lead replies.",
            "Reminds the lead before the meeting, and chases a reschedule if they do not turn up.",
            "Leaves your salesperson a task saying exactly what to do next.",
        ]),
    ],
)

story += article(
    "Part 1 \u2014 Getting started", 2, "Create your workspace", "Sign-up",
    "One form, no card, and the AI already knows your business before you reach the dashboard.",
    [
        p("You create the workspace once. Your team is added afterwards from <b>Users</b> \u2014 they never sign "
          "up themselves."),
        bullets([
            "Open <b>leadbells.com</b> and choose <b>Start free trial</b>.",
            "Enter your <b>company name</b>, your <b>name</b>, <b>work e-mail</b>, <b>phone</b> and a "
            "<b>password</b> of at least 8 characters.",
            "Fill in your <b>website address</b>. This is the field that matters most \u2014 see the note below.",
            "Choose <b>Create account</b>. You are signed in as the Admin, and your 14-day trial starts.",
            "Open the verification e-mail and click the link. Until you do, a banner reminds you; nothing is blocked.",
        ], numbered=True),
        tip("<b>Give it your website.</b> LeadBells reads every page of it \u2014 what you sell, your prices, your "
            "cities, the questions your customers actually ask \u2014 and your agents start answering in your own "
            "words from the first call. It takes about a minute and you can add or change it later from "
            f"<b>Settings {A} Organization</b>.", "Why the website field matters"),
        p("Your free trial", "sub"),
        p("The trial runs <b>14 days with every feature unlocked</b> and 10 AI calls so you can try the agent on "
          "your own leads. No card is needed. When it ends you pick a plan; until you do, the workspace is locked "
          f"and signing in takes you straight to the payment page. Prices start at {R}444 a month."),
    ],
    "02-register.jpg",
    "The sign-up form. The website field is what teaches your AI the business.",
)

story += article(
    "Part 1 \u2014 Getting started", 3, "Sign in", "Sign-in",
    "Your workspace address, your e-mail and your password.",
    [
        bullets([
            "Go to your workspace address.",
            "Enter your <b>workspace</b> (the short name chosen at sign-up), your <b>e-mail</b> and your "
            "<b>password</b>.",
            "Choose <b>Sign in</b>.",
        ], numbered=True),
        p("Forgot the password? <b>Forgot password</b> sends a reset link to your e-mail; it is valid for a short "
          "time and can be used once."),
        tip("Never share a login. Each person gets their own, with their own role \u2014 and every call, note and "
            "change is recorded against the person who made it."),
    ],
    "01-login.jpg",
    "The sign-in screen.",
)

story += article(
    "Part 1 \u2014 Getting started", 4, "Your home screen", "Dashboard",
    "What happened, what is slipping, and what the AI did while you were away.",
    [
        p("The dashboard is a live snapshot of the whole workspace. The tiles are not decoration \u2014 each one "
          "is a link to the list behind it."),
        table(
            ["Tile", "What it tells you"],
            [
                ["Total leads", "Every prospect in the pipeline, from every source."],
                ["Hot leads", "High intent \u2014 the ones to call today."],
                ["Overdue follow-ups", "Leads going cold because a task was missed. Your team is alerted too."],
                ["AI calls today", "Queued or live right now, and the week's answer rate."],
                ["Interested on calls", "How many answered calls ended with real interest."],
                ["Avg. lead score", "The scoring engine's view of the pipeline, out of 100."],
            ],
            [36 * mm, CONTENT_W - 36 * mm],
        ),
        Spacer(1, 5),
        p("The menu, group by group", "sub"),
        table(
            ["Group", "What lives there"],
            [
                ["Pipeline", "Leads, follow-up tasks, calls, conversations, handoffs, appointments, bookings"],
                ["AI Engine", "Chat agents, knowledge base, lead scoring"],
                ["Automation", "AI Automation, Leads Scrap AI, workflows, integrations, webhooks, API keys"],
                ["Insights", "Analytics, visitor tracking, notifications"],
                ["Workspace", "Users, support tickets, billing, settings, API credentials"],
            ],
            [26 * mm, CONTENT_W - 26 * mm],
        ),
        Spacer(1, 5),
        tip("Press <b>Ctrl + K</b> (or <b>\u2318 K</b>) anywhere to jump to a page by name instead of hunting "
            "through the menu."),
    ],
    "03-dashboard.jpg",
    "The home screen of a live workspace. Every tile is a link to the list behind it.",
)

# ── Part 2 ────────────────────────────────────────────────────────────
story += article(
    "Part 2 \u2014 Working the pipeline", 5, "Leads", "Pipeline",
    "Every prospect your agents, imports and team captured, in one list.",
    [
        p("The list shows the stage, the temperature, the score, where the lead came from, and what the AI or your "
          "team is doing about it next. Switch between <b>Table</b> and <b>Pipeline</b> view at the top right of "
          "the filter bar."),
        p("Adding leads", "sub"),
        table(
            ["Way in", "How"],
            [
                ["Automatically", "The website widget, WhatsApp, an inbound call or the API create the lead as it "
                                  "arrives. Nothing to do."],
                ["<b>Add Lead</b>", "One lead by hand \u2014 name, phone, e-mail, company and source."],
                ["<b>Import Excel / CSV</b>", "A whole file at once. Map your columns to the fields on screen."],
                ["Prospecting", "AI Automation and Leads Scrap AI find them for you (Part 6)."],
            ],
            [36 * mm, CONTENT_W - 36 * mm],
        ),
        Spacer(1, 5),
        p("Temperature decides how fast the AI calls", "sub"),
        p("Temperature is the single most important field on a lead. It decides how long LeadBells waits before "
          "the AI picks up the phone."),
        table(
            ["Temperature", "Means", "The AI calls"],
            [
                ["<b>Hot</b>", "Asked for a price, a demo or a callback", "Within about a minute"],
                ["<b>Warm</b>", "Interested, not ready", "After a short wait"],
                ["<b>Cold</b>", "Early, just browsing", "Later, at a civil hour"],
            ],
            [26 * mm, 70 * mm, CONTENT_W - 96 * mm],
        ),
        Spacer(1, 5),
        tip(f"<b>Export CSV</b> gives you the filtered list, not the whole database \u2014 filter first, then "
            f"export. Viewers cannot export at all."),
    ],
    "04-leads.jpg",
    "The leads list. Score, temperature, stage and the next AI step are all on one row.",
)

story += article(
    "Part 2 \u2014 Working the pipeline", 6, "Inside a lead", "Pipeline",
    "What the AI learned on the phone, and what it decided to do next.",
    [
        p("Opening a lead gives you the whole history in one page: what was said on every call, what was promised, "
          "the WhatsApp thread, the notes, and the score with the reason behind it."),
        p("The AI follow-up engine", "sub"),
        p("The panel at the top is the useful one. After each call the AI writes a plain summary of what happened, "
          "pulls out the actual requirement, scores the interest out of 100, and suggests the next step \u2014 "
          "call back, send a quote, book a meeting, or let it go."),
        p("What you can do from here", "sub"),
        table(
            ["Button", "What happens"],
            [
                ["<b>Call</b>", "Place an AI call now, or bridge the lead to your own phone."],
                ["<b>WhatsApp</b>", "Open the WhatsApp thread with this lead."],
                ["<b>E-mail</b>", "Write to the lead from your workspace's own address."],
                ["<b>Edit</b>", "Change the details. Status, temperature and owner save instantly from the panel "
                                "on the right."],
            ],
            [26 * mm, CONTENT_W - 26 * mm],
        ),
        Spacer(1, 5),
        tip("<b>How the AI talks to this lead</b> lets you add a line of context for one lead only \u2014 a "
            "discount already offered, a name to use, a subject to avoid. The agent reads it before it dials."),
    ],
    "05-lead-detail.jpg",
    "A real lead: the AI's call summary, the requirement it extracted, and the next step it chose.",
)

story += article(
    "Part 2 \u2014 Working the pipeline", 7, "Follow-up tasks", "Pipeline",
    "Everything the AI and your team promised, with the overdue ones shouting first.",
    [
        p("A task is created whenever something is owed to a lead: the AI promised to call back, a customer asked "
          "for details, a booking needs confirming, a meeting needs setting up. Tasks carry the reason, so nobody "
          "has to go back and listen to the call."),
        bullets([
            "<b>Overdue</b> \u2014 past due. The owner and the admins are alerted automatically.",
            "<b>Due today</b> \u2014 finish before the end of the day.",
            "<b>Upcoming</b> \u2014 scheduled ahead.",
            "<b>Done today</b> \u2014 completed, so the day's work is visible.",
        ]),
        p("Filter by time, by status and by owner. <b>Done</b> closes a task; the arrow beside it opens the lead "
          "it belongs to."),
        tip("A task tagged <b>AI</b> was created by the agent, not by a person. The description is the AI's own "
            "words about what the customer asked for."),
    ],
    "06-follow-up-tasks.jpg",
    "Follow-up tasks. Each one says who, what was promised and how late it is.",
)

story += article(
    "Part 2 \u2014 Working the pipeline", 8, "Lead scoring", "AI Engine",
    "A number out of 100 that says who is worth calling first.",
    [
        p("Every lead carries a score. It moves on its own as the lead behaves: what they said on the call, how "
          "fast they replied, which pages they read, whether they asked for a price, whether they booked."),
        p("On this page you set what counts for your business and by how much, so the score reflects your sales "
          "process rather than a generic one. Change a weight and the pipeline re-scores."),
        tip("Scoring is what makes <b>Hot</b> mean something. Get the weights right and the top of your leads "
            "list becomes your call sheet for the day."),
    ],
    "13-lead-scoring.jpg",
    "Lead scoring rules.",
)

# ── Part 3 ────────────────────────────────────────────────────────────
story += article(
    "Part 3 \u2014 The AI on the phone", 9, "Set up the calling agent", "Settings",
    "Who calls your leads, in which language, and what they say.",
    f"".join([]) and None or [
        p(f"Open <b>Settings {A} AI Calling</b>. The banner at the top tells you whether calling is live and which "
          f"accounts it is using."),
        p("The AI agent", "sub"),
        table(
            ["Field", "What it does"],
            [
                ["<b>Agent name</b>", "The name the agent gives on the phone."],
                ["<b>Company name</b>", "How the agent says your company out loud."],
                ["<b>Agent is a</b>", "Female or male, or match the voice. This fixes Hindi grammar \u2014 a "
                                      "female voice must say \u201cmain karti hoon\u201d, not \u201ckarta hoon\u201d."],
                ["<b>Language</b>", "English, Hindi, or Hinglish. Choose <b>Hindi</b> and the agent speaks Hindi "
                                    "from the first word to the last, and never drifts into English."],
                ["<b>Voice</b>", "The voice itself. Hindi voices are listed separately from Indian-English ones."],
            ],
            [32 * mm, CONTENT_W - 32 * mm],
        ),
        Spacer(1, 5),
        p("The rest of the page", "sub"),
        bullets([
            "<b>When to call</b> \u2014 the wait after a lead arrives, per temperature, and your calling hours.",
            "<b>What to say</b> \u2014 the opening line, what to ask, what to push for, what never to promise.",
            "<b>Appointment reminders</b> \u2014 the day-before and just-before WhatsApp, and the no-show rescue.",
            "<b>Inbound</b> \u2014 the AI receptionist that answers calls coming <i>in</i> to your number.",
        ]),
        tip("These settings belong to <b>this workspace only</b>. A second workspace can run a completely "
            "different agent, in a different language, with a different voice \u2014 nothing is shared."),
    ],
    "20-settings-calling.jpg",
    "AI Calling settings, set to a Hindi female voice.",
)

story += article(
    "Part 3 \u2014 The AI on the phone", 10, "Calls: recordings, transcripts and outcomes", "Pipeline",
    "Every AI call, bridged call and logged call, with what the AI decided next.",
    [
        p("Each row is one call: who it was, what kind, how it ended, the interest score, the summary, the next "
          "step, how long it ran and when. Open a row for the recording and the full transcript."),
        table(
            ["Result", "What it means"],
            [
                ["<b>Interested</b>", "The lead wants to go further. The next step is on the row."],
                ["<b>Meeting booked</b>", "The AI agreed a time and it is in Appointments already."],
                ["<b>No answer</b>", "Nobody picked up. A re-engage call is scheduled on its own."],
                ["<b>Not interested</b>", "Closed out, with the reason in the summary."],
                ["<b>Cancelled</b>", "Stopped before it connected \u2014 by a person or by the quota."],
            ],
            [34 * mm, CONTENT_W - 34 * mm],
        ),
        Spacer(1, 5),
        p("<b>Answer rate</b> and <b>Interested</b> at the top are this week's figures \u2014 the two numbers that "
          "tell you whether the script is working."),
        tip("Calls are charged against your plan's monthly AI-call allowance. <b>Billing</b> shows how many you "
            "have used."),
    ],
    "07-calls.jpg",
    "The calls list, with real AI summaries and the next step for each one.",
)

story += article(
    "Part 3 \u2014 The AI on the phone", 11, "Handoffs", "Pipeline",
    "The moments a person should take over, queued in one place.",
    [
        p("A handoff is raised when the agent decides a human is needed \u2014 the customer asked for one, the "
          "question is outside what the AI knows, the deal got serious, or someone used one of your handoff "
          "words. The lead, the thread and the full history are already on screen when you pick it up."),
        tip("Set the words that trigger a handoff in the WhatsApp settings \u2014 \u201cmanager\u201d, "
            "\u201cinsaan\u201d, \u201ccall me\u201d and anything else your customers actually say."),
    ],
    "23-handoffs.jpg",
    "The handoff queue.",
)

# ── Part 4 ────────────────────────────────────────────────────────────
story += article(
    "Part 4 \u2014 WhatsApp and chat", 12, "Two-way WhatsApp AI", "Settings",
    "The AI answers your customers on WhatsApp, with everything it knows about them.",
    [
        p(f"Open <b>Settings {A} WhatsApp AI</b>. When a lead writes to your WhatsApp number, the AI replies with "
          f"the full picture: what was said on the calls, the meetings on the books, your knowledge base, your "
          f"pictures and your booking forms."),
        p("What it can do in a chat", "sub"),
        bullets([
            "Answer questions from your own material, in the customer's language.",
            "<b>Look at pictures the customer sends</b> and answer about them.",
            "Send your pictures back \u2014 packages, rooms, brochures, price lists.",
            "Book a meeting, schedule a callback, or trigger an AI call.",
            "Collect every field of a booking form and share the payment link.",
            "Hand the chat to a person the moment one is needed.",
        ]),
        p("The settings that matter", "sub"),
        table(
            ["Field", "What it does"],
            [
                ["<b>Agent name</b>", "Empty = the same name as your calling agent."],
                ["<b>Agent is a</b>", "Keeps Hindi grammar right, exactly as on calls."],
                ["<b>Language</b>", "Match the customer, or force one language."],
                ["<b>Wait before replying</b>", "A couple of seconds, so people can finish typing two or three "
                                                "short lines before the AI answers all of them at once."],
                ["<b>What you sell &amp; how to talk</b>", "Your packages, prices and rules, in your own words. "
                                                           "This is what the AI quotes from."],
            ],
            [38 * mm, CONTENT_W - 38 * mm],
        ),
        Spacer(1, 5),
        tip("Once a teammate replies in a chat the AI steps back and stops answering, so a customer is never "
            "talking to both at once."),
    ],
    "21-settings-whatsapp.jpg",
    "WhatsApp AI settings, with the agent's persona and the business it sells.",
)

story += article(
    "Part 4 \u2014 WhatsApp and chat", 13, "Conversations", "Pipeline",
    "Every chat, from the website widget and from WhatsApp, in one inbox.",
    [
        p("Open a conversation to read it, see which lead it belongs to, and type a reply yourself. The AI's "
          "messages and your team's sit in the same thread in the order they were sent."),
        tip("A conversation always carries its lead. Anything the AI learns in a chat \u2014 a budget, a date, a "
            "requirement \u2014 updates the lead record without anyone retyping it."),
    ],
    "08-conversations.jpg",
    "The conversations inbox.",
)

story += article(
    "Part 4 \u2014 WhatsApp and chat", 14, "Bookings and payment links", "Pipeline",
    "The AI fills the form; you only handle the money.",
    [
        p("A booking form is a list of the things you must know before you can sell \u2014 travel dates, number of "
          "passengers, full names as on ID, class, city. You define it once; the AI asks for the fields one at a "
          "time in the chat, validates what it gets, and submits the booking when it has everything."),
        bullets([
            "A task is created for your team with every answer attached.",
            "If the form carries a payment link, the AI shares it straight away.",
            "If it does not, your team adds the link from this page and it is sent then.",
        ]),
        tip("This is the only point where a person is needed in a WhatsApp sale \u2014 everything up to the "
            "payment link is collected by the AI."),
    ],
    "10-bookings.jpg",
    "Bookings submitted from WhatsApp chats.",
)

# ── Part 5 ────────────────────────────────────────────────────────────
story += article(
    "Part 5 \u2014 Meetings", 15, "Appointments and Google Calendar", "Pipeline",
    "Meetings the AI booked and meetings you booked, in one calendar \u2014 and nobody forgets them.",
    [
        p("Every meeting the AI agrees on a call lands here, together with anything your team adds by hand. The "
          "list shows the date, the time, the attendee, who it is assigned to and its status."),
        p("Connect Google Calendar", "sub"),
        p("Each salesperson connects their own calendar once, with <b>Connect Google Calendar</b>. After that:"),
        bullets([
            "Every meeting goes into their Google Calendar with a Google Meet link.",
            "The AI only offers slots that are actually free there \u2014 no double bookings.",
            "Moving or cancelling in LeadBells updates Google, and the attendee is told.",
        ]),
        p("Reminders and the no-show rescue", "sub"),
        table(
            ["When", "What happens"],
            [
                ["About a day before", "The lead gets a WhatsApp with the details (and an e-mail if you have one)."],
                ["Shortly before", "A short WhatsApp to the lead, and a nudge to the salesperson."],
                ["Just after the time", "If nobody marked it done, the salesperson is asked \u201cdid it "
                                        "happen?\u201d"],
                ["No-show", "A missed-meeting WhatsApp goes out and the AI calls to rebook, on its own."],
            ],
            [36 * mm, CONTENT_W - 36 * mm],
        ),
        Spacer(1, 5),
        tip("A meeting booked or moved minutes ago never gets a \u201creminder about tomorrow\u201d straight "
            "after its own confirmation."),
    ],
    "09-appointments.jpg",
    "Appointments, with the Google Calendar connection at the top.",
)

# ── Part 6 ────────────────────────────────────────────────────────────
story += article(
    "Part 6 \u2014 Teaching the AI", 16, "Chat agents and the website widget", "AI Engine",
    "The assistant that talks to visitors on your own site.",
    [
        p("An agent is one assistant with its own personality, its own instructions, its own tools and its own "
          "look. Run one for the whole site, or different agents on different pages or different sites."),
        bullets([
            "<b>Create Agent</b> \u2014 name it, describe what it is for, choose its model.",
            "Give it its instructions: tone, what to push for, what never to say.",
            "Switch on the tools it may use \u2014 capture a lead, book a meeting, request a human, search your "
            "knowledge base.",
            "Publish it, then copy the embed snippet onto your site.",
        ], numbered=True),
        p(f"Colours, greeting, avatar and position live in <b>Settings {A} Branding</b>."),
        tip("A draft agent is not live. <b>Active</b> on the card means it is answering visitors right now."),
    ],
    "11-agents.jpg",
    "The agents list.",
)

story += article(
    "Part 6 \u2014 Teaching the AI", 17, "Knowledge base", "AI Engine",
    "Everything your agents know \u2014 and where they are told to stop.",
    [
        p("Add documents, pages and notes. Each one is split, indexed and searchable within seconds, and from then "
          "on every agent \u2014 on chat, on WhatsApp and on the phone \u2014 answers out of it."),
        table(
            ["Source", "Use it for"],
            [
                ["<b>File</b>", "PDFs, decks, price lists, brochures, proposals."],
                ["<b>Page</b>", "A page of your website, read and kept up to date."],
                ["<b>Note</b>", "Something you simply type \u2014 a policy, an offer, an exception."],
            ],
            [26 * mm, CONTENT_W - 26 * mm],
        ),
        Spacer(1, 5),
        p("<b>Test Search</b> asks the knowledge base a question the way an agent would, so you can see what it "
          "will find before a customer does."),
        tip("The agent is told to answer only from this material. When something is not covered it says so and "
            "offers a person, instead of inventing an answer."),
    ],
    "12-knowledge-base.jpg",
    "The knowledge base. Each source shows how many chunks were indexed.",
)

story += article(
    "Part 6 \u2014 Teaching the AI", 18, "AI Automation: find new prospects", "Automation",
    "Businesses newly listed on Google Maps, scored for fit before you ever call them.",
    [
        p("A campaign is a set of business categories and cities to sweep. LeadBells finds the businesses, the AI "
          "scores each one for how well it fits what you sell, and every prospect is verified against its real "
          "listing before it reaches you."),
        bullets([
            "<b>Prospects found</b> \u2014 everything the sweep turned up.",
            "<b>Awaiting review</b> \u2014 waiting for you. Nothing enters your pipeline until you approve it.",
            "<b>Newly listed</b> \u2014 recently added to Maps, so nobody else has called them yet.",
            "<b>No website</b> \u2014 the strongest buying signal of the lot, if you sell websites.",
        ]),
        tip("Approve, then import. A prospect becomes a lead only when you say so, so the pipeline never fills up "
            "with noise. This page is admin-only."),
    ],
    "14-ai-automation.jpg",
    "AI Automation, with prospects waiting for review.",
)

story += article(
    "Part 6 \u2014 Teaching the AI", 19, "Leads Scrap AI", "Automation",
    "Prospects gathered from public sources, in a queue you approve.",
    [
        p("Leads Scrap AI collects prospects from public sources and puts them in a review queue with what it "
          "found about each one. You approve the ones worth having, and they become leads with their source "
          "recorded."),
        tip("Like AI Automation, nothing reaches your pipeline unapproved."),
    ],
    "15-leads-scrap-ai.jpg",
    "The Leads Scrap AI review queue.",
)

# ── Part 7 ────────────────────────────────────────────────────────────
story += article(
    "Part 7 \u2014 Insights", 20, "Analytics", "Insights",
    "Whether the whole thing is working, from first visit to booked meeting.",
    [
        p("Choose a period at the top right. The tiles cover traffic, conversations, leads captured, qualified "
          "leads, hot leads, handoffs and appointments booked by the AI."),
        bullets([
            "<b>Trends</b> \u2014 leads against conversations, day by day. A gap between the two lines is the "
            "thing to go and look at.",
            "<b>Conversion funnel</b> \u2014 visitors, conversations, leads, qualified, appointments, with the "
            "drop-off between each pair.",
        ]),
        tip("The funnel is the honest view: it shows where people leave, not just how many arrived."),
    ],
    "16-analytics.jpg",
    "Analytics over the last 30 days, with the conversion funnel on the right.",
)

story += article(
    "Part 7 \u2014 Insights", 21, "Notifications", "Insights",
    "What needs you, in one list.",
    [
        p("New leads, hot leads, handoffs, overdue follow-ups, call summaries and booking requests all land here "
          f"as they happen. Choose who is alerted about what in <b>Settings {A} Notifications</b> \u2014 by role, "
          f"by e-mail, and to your team chat if you connect one."),
        tip("Turn off what you do not read. A notification list everybody ignores is worse than none."),
    ],
    "25-notifications.jpg",
    "The notification list.",
)

# ── Part 8 ────────────────────────────────────────────────────────────
story += article(
    "Part 8 \u2014 Your workspace", 22, "Your team and their roles", "Workspace",
    "Invite people, give them a role, and pause them when they leave.",
    [
        bullets([
            "Choose <b>Add User</b>.",
            "Enter their name, e-mail and phone.",
            "Pick the role \u2014 Admin, Sales manager, Salesperson or Viewer (see section 1).",
            "Save. They receive an e-mail with a link to set their own password.",
        ], numbered=True),
        p("The toggle beside a member pauses their access without deleting anything they did. The pencil edits "
          "them; the bin removes them. <b>Staff Deletion Requests</b> holds removals that are waiting on approval."),
        tip("The <b>Viewer</b> role is for people who need to see the pipeline but must not have your customers' "
            "contact details \u2014 an auditor, an investor, a trainee. E-mail and phone show as "
            "\u201cHidden\u201d everywhere, and exports are blocked."),
    ],
    "17-users.jpg",
    "The team list, with each member's role, status and last sign-in.",
)

story += article(
    "Part 8 \u2014 Your workspace", 23, "Plan and billing", "Workspace",
    "What you are on, how much of it you have used, and how to change it.",
    [
        p("The card at the top shows your plan, whether it is active, when it renews, and your monthly AI-call "
          "allowance. <b>This month</b> shows what you have actually used: AI calls, WhatsApp messages, team "
          "members and leads."),
        p("The plans", "sub"),
        table(
            ["Plan", "Price", "AI calls", "Built for"],
            [
                ["Basic", f"{R}444 / month", "5", "A solo owner who wants the AI to make the first call"],
                ["Standard", f"{R}700 / month", "15", "A small sales team that lives on WhatsApp"],
                ["Premium", f"{R}1,500 / month", "40", "A team that must not miss a single enquiry"],
                ["Pro", f"{R}2,400 / month", "75", "An agency or a multi-branch business"],
                ["Build your own", f"from {R}444", "you choose", "Pay for exactly what you use"],
            ],
            [30 * mm, 30 * mm, 20 * mm, CONTENT_W - 80 * mm],
        ),
        Spacer(1, 5),
        bullets([
            "All prices exclude <b>18% GST</b>, which is added at checkout.",
            "<b>Yearly</b> is charged for ten months \u2014 two months free.",
            "Payment is by card, UPI, net banking or wallet through Razorpay.",
            "An invoice is raised for every payment and kept in your workspace.",
        ]),
        tip("When the trial ends the workspace locks and signing in takes you here. Nothing is deleted \u2014 pick "
            "a plan and everything is exactly where you left it."),
    ],
    "18-billing.jpg",
    "Plan and billing, showing this month's usage against the allowance.",
)

story += article(
    "Part 8 \u2014 Your workspace", 24, "Organization settings", "Workspace",
    "Your company details, your website, your branding, your alerts and your own mail server.",
    [
        table(
            ["Tab", "What you set there"],
            [
                ["<b>Organization</b>", "Company name, domain, your website (the one the AI learns from), and "
                                        "where your chat widget may be embedded."],
                ["<b>AI Calling</b>", "The calling agent \u2014 section 9."],
                ["<b>WhatsApp AI</b>", "The WhatsApp agent \u2014 section 12."],
                ["<b>Branding</b>", "Colours and typography for the embedded chat widget."],
                ["<b>AI &amp; Preferences</b>", "Which AI provider and model power the chatbot; timezone, "
                                                "language and currency."],
                ["<b>Notifications</b>", "Who is alerted about what, and your team-chat integration."],
                ["<b>Security</b>", "Change your password."],
                ["<b>Privacy &amp; Compliance</b>", "Export your data, or request deletion of the workspace."],
            ],
            [36 * mm, CONTENT_W - 36 * mm],
        ),
        Spacer(1, 5),
        p("Send e-mail from your own address", "sub"),
        p("Put your own SMTP server under <b>Organization</b> and <b>every</b> e-mail this workspace sends goes "
          "from your address \u2014 call summaries, meeting invites, team alerts, password resets, the lot. "
          "<b>Test connection</b> checks it before you save, and <b>Send test e-mail</b> proves it end to end."),
        tip("Leave SMTP empty and LeadBells sends from the platform's address instead. Nothing breaks either way."),
    ],
    "19-settings-org.jpg",
    "Settings, with the workspace's plan and status on the bar above the tabs.",
)

story += article(
    "Part 8 \u2014 Your workspace", 25, "API credentials: use your own keys", "Workspace",
    "Point every integration at your own accounts, and your own quota.",
    [
        p("Admins can give LeadBells their own keys for the AI provider, the calling provider, WhatsApp, e-mail, "
          "storage and search. Each workspace then runs on its own accounts and its own limits."),
        bullets([
            "Keys are encrypted with AES-256-GCM before they touch the database.",
            "They are <b>write-only</b>: a saved key is never sent back to the browser, so it cannot be read from "
            "this page, the network tab or the page source. Only the last few characters are shown.",
            "<b>Test connection</b> tries the key for real before you rely on it.",
            "Leave a field empty to keep using the platform default.",
        ]),
        tip("This is also where you rotate a key: paste the new one over the old and save. Nothing else changes."),
    ],
    "22-credentials.jpg",
    "API Credentials. Saved keys show only their last characters.",
)

story += article(
    "Part 8 \u2014 Your workspace", 26, "Integrations, webhooks and the API", "Automation",
    "Push what happens in LeadBells into the rest of your stack.",
    [
        table(
            ["Page", "Use it to"],
            [
                ["<b>Integrations</b>", "Connect the tools you already use \u2014 CRM, team chat, calendar."],
                ["<b>Webhooks</b>", "Have LeadBells POST to a URL of yours when a lead is created, a call ends, a "
                                    "meeting is booked or a handoff is raised."],
                ["<b>API Keys</b>", "Create a key for your own software to read and create leads directly."],
                ["<b>Workflows</b>", "Chain the follow-ups yourself \u2014 what happens, after how long, to whom."],
            ],
            [30 * mm, CONTENT_W - 30 * mm],
        ),
        Spacer(1, 5),
        tip("Treat an API key like a password. Anyone holding it can read and create leads in your workspace. "
            "Delete one the moment it is no longer used."),
    ],
    "24-integrations.jpg",
    "Integrations.",
)

# ── Part 9 ────────────────────────────────────────────────────────────
story += article(
    "Part 9 \u2014 Help", 27, "Support tickets", "Workspace",
    "Raise a problem without leaving the workspace.",
    [
        p("Open a ticket, describe what happened, and follow the replies in the same place. The ticket carries "
          "your workspace, so nobody has to ask which account you are on."),
        tip("Include what you expected, what happened instead, and the time it happened. It is usually the "
            "difference between a reply and three rounds of questions."),
    ],
    "26-support-tickets.jpg",
    "Support tickets.",
)

story += article(
    "Part 9 \u2014 Help", 28, "Questions people ask", "Help",
    "The short answers.",
    [
        table(
            ["Question", "Answer"],
            [
                ["Will the AI make things up about my product?",
                 "It answers from your knowledge base and your website and is told to stay inside them. When "
                 "something is not covered it says so and offers a person."],
                ["Can a real person take over a conversation?",
                 "Yes. The agent raises a handoff when one is needed, or a rep can jump in unprompted. The AI then "
                 "stops replying in that chat."],
                ["Can the AI call international numbers?",
                 "Yes \u2014 the calling works wherever your number can dial."],
                ["Whose AI keys does it use?",
                 f"Either. Run on the platform defaults, or point the workspace at your own under <b>Settings {A} "
                 f"API Credentials</b>."],
                ["What happens to my data?",
                 "It stays in your workspace, separated at the database level from every other customer, with "
                 "role-based access and an audit trail. Export or delete it whenever you want."],
                ["Can I change plan later?",
                 "Yes, any time, from Billing. Nothing is lost when you move up or down."],
                ["Does a Viewer really never see a phone number?",
                 "Correct. Contact fields show as \u201cHidden\u201d in the list, on the lead, in the API and in "
                 "exports \u2014 and Viewers cannot export at all."],
                ["Why did a lead not get called?",
                 "Most often: outside your calling hours, no phone number on the lead, or the month's AI-call "
                 "allowance is used up. The Calls page gives the reason on the row."],
            ],
            [52 * mm, CONTENT_W - 52 * mm],
        ),
        Spacer(1, 8),
        tip("Still stuck? Raise a support ticket (section 27), or ask the agent on leadbells.com \u2014 it will "
            "answer or hand you to a human.", "Need a person"),
    ],
    newpage=False,
)

# ─── Build ────────────────────────────────────────────────────────────
doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN + 4 * mm,
    title="LeadBells User Manual", author="Cyberbells ITES Services Pvt Ltd",
    subject="AI Leads Follow up, tracking & calling software",
)
frame = Frame(MARGIN, MARGIN + 4 * mm, CONTENT_W, PAGE_H - 2 * MARGIN - 4 * mm, id="f")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover_bg),
    PageTemplate(id="body", frames=[frame], onPage=chrome),
])
doc.build(story)
print("written:", OUT, f"({os.path.getsize(OUT) / 1024 / 1024:.1f} MB)")
