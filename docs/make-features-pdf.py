"""Builds docs/LeadBells-Features.pdf - a short client-facing feature list."""
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle, KeepTogether)

OUT = "C:/Users/aman8/Downloads/AI_Lead_Generation/docs/LeadBells-Features.pdf"
BRAND = colors.HexColor("#4F46E5")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontSize=24, leading=30, textColor=INK, alignment=TA_CENTER, spaceAfter=4)
TAG = ParagraphStyle("TAG", parent=ss["Normal"], fontSize=12, leading=16, textColor=BRAND, alignment=TA_CENTER, spaceAfter=14)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontSize=14, leading=18, textColor=BRAND, spaceBefore=12, spaceAfter=6)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontSize=10, leading=14, textColor=INK)
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=9, leading=12, textColor=MUTED)
STEP_T = ParagraphStyle("STEP_T", parent=BODY, fontName="Helvetica-Bold")


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, BODY), leftIndent=12, value="•") for i in items],
        bulletType="bullet", start="•", leftIndent=14, bulletFontSize=9, spaceAfter=4,
    )


def section(title, items):
    return KeepTogether([Paragraph(title, H2), bullets(items)])


def steps_table(rows):
    data = [[Paragraph(f"<b>{n}</b>", BODY), Paragraph(f"<b>{t}</b><br/>{d}", BODY)] for n, t, d in rows]
    t = Table(data, colWidths=[12 * mm, 158 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TEXTCOLOR", (0, 0), (0, -1), BRAND),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12 * mm, "LeadBells - AI Leads Follow up, tracking & calling software")
    canvas.drawRightString(190 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


story = [
    Spacer(1, 30),
    Paragraph("LeadBells", H1),
    Paragraph("AI Leads Follow up, tracking &amp; calling software", TAG),
    Paragraph(
        "LeadBells takes every lead from the moment it arrives to a booked meeting - automatically. "
        "The AI calls within seconds, qualifies the lead, follows up on WhatsApp, books the meeting in the "
        "salesperson's calendar, reminds the customer, and rescues no-shows. Your team only talks to leads that are ready.",
        BODY,
    ),
    Spacer(1, 8),

    Paragraph("How it works - step by step", H2),
    steps_table([
        (1, "Lead comes in", "Added manually, imported from Excel/CSV, captured by the website chat widget, sent by a form/API/webhook, or found by Leads Scrap AI."),
        (2, "AI calls within seconds", "The AI agent dials the lead immediately (inside your calling hours), one lead at a time, in a natural human-like Indian voice (English / Hindi / Hinglish)."),
        (3, "No answer? WhatsApp + retry", "A 'missed call' WhatsApp goes out at once and the AI tries again later, up to the limit you set."),
        (4, "Qualify on the call", "Requirement, budget, timeline and decision-maker are captured. Every call is recorded, transcribed and summarised."),
        (5, "Book, transfer or call back", "On the same call the AI books a meeting, schedules a callback, or transfers live to a named person (sales, support, founder...)."),
        (6, "WhatsApp after every call", "Thank-you message with the meeting date/time and the salesperson's name & phone, or the agreed callback time, or the details the AI promised on the call."),
        (7, "Hot lead to a salesperson", "Interested leads are marked hot, assigned to a salesperson and a follow-up task is created with a deadline."),
        (8, "Salesperson calls (recorded)", "Click-to-call from the dashboard; the call is recorded and transcribed and the AI suggests the next action."),
        (9, "Overdue? Manager alerted", "Tasks past their deadline escalate to the manager automatically."),
        (10, "Meeting reminders", "The customer gets WhatsApp/e-mail reminders a day before and an hour before; the salesperson gets a nudge."),
        (11, "No-show rescue", "If the customer does not turn up, they get a 'we missed you' WhatsApp and the AI calls to fix a new time - and moves the meeting itself."),
        (12, "Cold leads re-engaged", "Leads that go quiet get a WhatsApp check-in and an AI call again after a set number of days."),
        (13, "Pipeline updated live", "Lead -> Contacted -> Interested -> Follow-up -> Meeting -> Won / Lost - every change visible in real time."),
    ]),
    PageBreak(),

    Paragraph("Feature list", H1),
    Spacer(1, 6),

    section("1. Lead capture", [
        "Manual lead entry with custom fields and tags",
        "Excel / CSV import (Name, Phone, Email, Description) - with 'AI calls every lead' option",
        "Website chat widget that captures and qualifies visitors",
        "Webhooks and REST API (API keys) for forms, landing pages, ads and third-party tools",
        "Leads Scrap AI - prospecting from social platforms and public sources",
        "Automatic de-duplication by phone/e-mail and lead source tracking",
        "Lead scoring and temperature (cold / warm / hot)",
    ]),
    section("2. AI calling agent", [
        "Calls every new lead within seconds, strictly one call at a time",
        "Human-like voice; slow clear greeting, then normal Indian conversational pace",
        "English, Hindi and Hinglish; numbers and amounts spoken in words",
        "Dynamic behaviour per lead: stage, history, description and brief are used on every call",
        "Playbooks - different script, tone or language for different kinds of leads",
        "Calling hours, retry count and retry delay per workspace",
        "Bulk AI call for selected leads - now or scheduled",
        "Live transfer to named humans (name, number, role) or to the assigned salesperson",
        "In-call appointment booking and callback scheduling",
        "Call recording, transcript, summary, sentiment, objections and next-action analysis",
        "Realtime call status in the dashboard: queued, ringing, on call, transferring, ended",
        "Test call button to hear the agent before going live",
    ]),
    section("3. WhatsApp automation (Twilio)", [
        "Missed-call message when the lead does not answer",
        "Thank-you message after every answered call",
        "Appointment confirmation with date, time, salesperson name and phone",
        "Callback confirmation with the agreed time",
        "Details promised by the AI on the call are delivered automatically",
        "Meeting reminders (day before / hour before) and 'we missed you' messages",
        "Check-in messages for cold leads",
        "Approved WhatsApp templates, editable message text per workspace",
    ]),
    section("4. Follow-up & task management", [
        "Automatic follow-up tasks from every call outcome",
        "Due-now nudges to the salesperson; overdue escalation to managers",
        "Task cards with lead, phone, due time and one-tap complete / reschedule",
        "AI decides the next action after human calls too",
        "Cold-lead re-engagement after N days (WhatsApp + AI call)",
    ]),
    section("5. Appointments & calendar", [
        "Meetings booked by the AI, by the team or by visitors in the widget",
        "Google Calendar sync for every salesperson with Google Meet links",
        "Free/busy check - the AI only offers slots that are actually free",
        "E-mail confirmation with calendar invite (.ics), reschedule and cancellation e-mails",
        "Reminders to the customer and the salesperson",
        "No-show detection, 'did it happen?' prompt, auto no-show and AI rescue call",
        "Reschedule history and one-click mark done / no-show",
    ]),
    section("6. Human calls", [
        "Click-to-call from the lead page (bridged through Twilio)",
        "Recording and transcription of salesperson calls",
        "AI summary and suggested next step after each human call",
        "Call notes, outcomes and manual call logging",
    ]),
    section("7. Pipeline & CRM", [
        "Kanban pipeline: Lead, Contacted, Interested, Follow-up, Meeting, Won, Lost",
        "Lead timeline: calls, WhatsApp, tasks, status changes, notes",
        "Assignment rules (round-robin / manual) and ownership",
        "Filters, search, tags, custom fields and bulk actions",
    ]),
    section("8. Team, roles & notifications", [
        "Roles: Admin, Sales Manager, Salesperson, Viewer",
        "Salespeople see only their own leads, tasks and calendar",
        "In-app, push and e-mail notifications; Slack / Teams webhooks",
        "Manager alerts for hot leads, overdue follow-ups and call summaries",
    ]),
    section("9. Dashboard & analytics", [
        "Live dashboard: calls today, hot leads, meetings, overdue tasks",
        "Call statistics: connect rate, outcomes, duration, cost",
        "Pipeline and conversion reporting; visitor tracking for the website",
    ]),
    section("10. AI chat & knowledge base", [
        "AI chat agents for the website widget with handoff to humans",
        "Knowledge base from documents, URLs and FAQs",
        "AI automation rules and workflows for follow-ups",
    ]),
    section("11. Settings, security & platform", [
        "Workspace branding: logo and name across the dashboard",
        "Per-workspace API credentials vault (AI, Vapi, Twilio, Google, SMTP...) - secrets encrypted",
        "Calling settings, playbooks, transfer destinations and reminder rules in one place",
        "Multi-tenant SaaS with plans, billing and an owner console",
        "Audit logs, consent logs, data export and account deletion",
    ]),
    Spacer(1, 10),
    Paragraph("LeadBells - AI Leads Follow up, tracking &amp; calling software", SMALL),
]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
                        title="LeadBells - Features", author="LeadBells")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("written", OUT)
