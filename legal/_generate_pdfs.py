#!/usr/bin/env python3
"""Generate legal PDFs for [aRTS] — privacy policy, terms of service, data processing overview."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

ACCENT = HexColor('#FF5C00')
DARK = HexColor('#111111')
GREY = HexColor('#666666')
LIGHT_GREY = HexColor('#999999')
BG_GREY = HexColor('#F5F5F5')

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    'DocTitle', parent=styles['Title'],
    fontSize=18, leading=22, textColor=DARK, spaceAfter=4,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'DocSubtitle', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=LIGHT_GREY, spaceAfter=20,
    fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'SectionHead', parent=styles['Heading2'],
    fontSize=11, leading=14, textColor=DARK, spaceBefore=18, spaceAfter=6,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontSize=9, leading=13, textColor=HexColor('#333333'), spaceAfter=8,
    fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'BodyBold', parent=styles['Normal'],
    fontSize=9, leading=13, textColor=DARK, spaceAfter=4,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'Footer', parent=styles['Normal'],
    fontSize=7, textColor=LIGHT_GREY, fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'TableCell', parent=styles['Normal'],
    fontSize=8, leading=11, textColor=HexColor('#333333'),
    fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'TableHeader', parent=styles['Normal'],
    fontSize=8, leading=11, textColor=HexColor('#FFFFFF'),
    fontName='Helvetica-Bold',
))


def _footer(canvas, doc, text):
    canvas.saveState()
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(LIGHT_GREY)
    canvas.drawString(20 * mm, 12 * mm, text)
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f'Page {doc.page}')
    canvas.restoreState()


# ─────────────────────────────────────────
# 1. Privacy Policy PDF
# ─────────────────────────────────────────

def generate_privacy_policy():
    path = os.path.join(OUT_DIR, 'privacy-policy.pdf')
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=25*mm)
    story = []
    S = styles

    footer_text = 'Last updated: 15 March 2026 | 4-arts.com'

    story.append(Paragraph('[aRTS] — Privacy Policy', S['DocTitle']))
    story.append(Paragraph('GDPR-compliant privacy policy pursuant to Art. 13/14 GDPR, TTDSG, TMG', S['DocSubtitle']))

    # 1. Controller
    story.append(Paragraph('1. Controller (GDPR Art. 13(1)(a))', S['SectionHead']))
    story.append(Paragraph(
        '[aRTS] — operated by [TO BE FILLED: Legal Name], [TO BE FILLED: Address], Germany.<br/>'
        'Email: arts4berlin@outlook.com<br/>'
        'See our Impressum (impressum.html) for full legal contact details.', S['Body']))

    # 2. Data We Collect
    story.append(Paragraph('2. Data We Collect', S['SectionHead']))
    story.append(Paragraph(
        'We collect data only when you take an explicit action (sign in, submit a form, make a purchase). '
        'No advertising cookies, third-party tracking scripts, or analytics are used. Data is stored both '
        'on your device (browser localStorage) and on our server (encrypted SQLite database on a Hetzner '
        'VPS in Helsinki, Finland — EU jurisdiction).', S['Body']))

    # 3. Processing Activities
    story.append(Paragraph('3. Processing Activities & Legal Basis', S['SectionHead']))

    activities = [
        ('Authentication (OAuth / Email+Password)',
         'Anonymised user identifier ("sub" claim), email address, display name. Passwords hashed with bcrypt.',
         'Contract performance — Art. 6(1)(b)', 'Until account deletion'),
        ('Session tokens',
         'Cryptographic session token in browser localStorage. Server stores SHA-256 hash.',
         'Contract performance — Art. 6(1)(b)', '7 days (sliding window) or until logout'),
        ('IP logging',
         'Encrypted IP address, login provider, tier, timestamp, encrypted user-agent.',
         'Legitimate interest — security — Art. 6(1)(f)', '90 days maximum'),
        ('User profile & preferences',
         'Alias, tier, join date, XP points, settings. PII encrypted with AES-GCM at rest.',
         'Contract performance — Art. 6(1)(b)', 'Until account deletion'),
        ('Favourites',
         'Piece IDs stored server-side. Client-side additionally encrypted with AES-GCM.',
         'Contract performance — Art. 6(1)(b)', 'Until account deletion'),
        ('Feedback',
         'Star rating, text (encrypted), page context.',
         'Consent — Art. 6(1)(a)', 'Until account deletion or consent withdrawal'),
        ('Newsletter',
         'Email (encrypted), name, subscription source.',
         'Consent — Art. 6(1)(a)', 'Until unsubscribe'),
        ('Payments & transactions (Stripe)',
         'Card data handled exclusively by Stripe. We store: transaction ID, amount, commission.',
         'Contract — Art. 6(1)(b); Legal obligation — Art. 6(1)(c)',
         '10 years (AO §147, UStG §14b), pseudonymised'),
        ('Algorithm & recommendations',
         'Behavioural signals (views, favourites, purchases), recommendation cache, click tracking.',
         'Legitimate interest — Art. 6(1)(f)', 'Impressions: 180 days; cache: regenerated; deleted on account deletion'),
        ('Content moderation (AI)',
         'Listing metadata, moderation verdicts, AI confidence scores.',
         'Legitimate interest — platform safety — Art. 6(1)(f)',
         'Anonymised on account deletion; audit trail retained'),
        ('Form submissions (Formspree)',
         'Inquiry content, reports, art submissions.',
         'Consent — Art. 6(1)(a)', 'Per Formspree privacy policy'),
    ]

    for title, data, basis, retention in activities:
        story.append(Paragraph(f'<b>{title}</b>', S['BodyBold']))
        story.append(Paragraph(f'Data: {data}<br/>Legal basis: {basis}<br/>Retention: {retention}', S['Body']))

    # 4. Device Storage
    story.append(Paragraph('4. Device Storage (TTDSG §25)', S['SectionHead']))
    story.append(Paragraph(
        'We use browser localStorage (and sessionStorage in Stealth Mode) instead of cookies. '
        'Under TTDSG §25, accessing device storage requires consent unless strictly necessary.', S['Body']))
    story.append(Paragraph(
        '<b>Strictly necessary (no consent required):</b> session token, theme preference, CAPTCHA state, stealth mode flag.<br/>'
        '<b>Consent-based:</b> feedback data, apparel voucher, view preferences, streak/XP data, bot settings, GDPR consent record.', S['Body']))

    # 5. Recipients
    story.append(Paragraph('5. Recipients & Third Parties', S['SectionHead']))
    recipients = [
        'Stripe (Stripe, Inc.) — payment processing',
        'Cloudflare (Cloudflare, Inc.) — CDN, DDoS protection, DNS',
        'Hetzner (Hetzner Online GmbH) — VPS hosting (Helsinki, Finland — EU)',
        'Formspree (Formspree, Inc.) — form submissions',
        'Google (Google LLC) — OAuth authentication',
        'Apple (Apple Inc.) — Sign In with Apple',
        'Resend (Resend, Inc.) — transactional emails',
    ]
    for r in recipients:
        story.append(Paragraph(f'• {r}', S['Body']))

    # 6. International Transfers
    story.append(Paragraph('6. International Data Transfers', S['SectionHead']))
    story.append(Paragraph(
        'Some providers (Stripe, Cloudflare, Google, Apple, Formspree, Resend) may process data in the US. '
        'Transfers are safeguarded by the EU-U.S. Data Privacy Framework and/or Standard Contractual Clauses (Art. 46(2)(c)). '
        'Our primary database is hosted within the EU (Hetzner, Helsinki, Finland).', S['Body']))

    # 7. Encryption
    story.append(Paragraph('7. Encryption & Security', S['SectionHead']))
    story.append(Paragraph(
        'All PII is encrypted at rest using AES-GCM. IP addresses and user-agents encrypted before storage. '
        'Client-side favourites additionally encrypted with keys derived from OAuth identifier. '
        'TLS 1.2+ enforced. Server protected by UFW, fail2ban, Cloudflare-only IP whitelisting.', S['Body']))

    # 8. Your Rights
    story.append(Paragraph('8. Your Rights (GDPR Art. 15-22)', S['SectionHead']))
    rights = [
        ('Right of access (Art. 15)', 'Request a copy of all personal data we hold.'),
        ('Right to rectification (Art. 16)', 'Correct inaccurate personal data.'),
        ('Right to erasure (Art. 17)', 'Delete your account via the iD dashboard. Immediate deletion of all personal data. Transaction records pseudonymised and retained 10 years (tax law). Tombstone hash retained 3 years (fraud prevention).'),
        ('Right to restriction (Art. 18)', 'Restrict processing in certain circumstances.'),
        ('Right to data portability (Art. 20)', 'Receive data in structured, machine-readable format.'),
        ('Right to object (Art. 21)', 'Object to processing based on legitimate interest.'),
        ('Automated decisions (Art. 22)', 'AI-assisted content moderation — right to human review.'),
        ('Withdrawal of consent (Art. 7(3))', 'Withdraw consent at any time without affecting prior processing.'),
    ]
    for title, desc in rights:
        story.append(Paragraph(f'<b>{title}</b> — {desc}', S['Body']))
    story.append(Paragraph('<b>Deletion timeline:</b> requests fulfilled within 30 days (Art. 12(3)). Self-service deletion is immediate.', S['Body']))

    # 9. Supervisory Authority
    story.append(Paragraph('9. Supervisory Authority', S['SectionHead']))
    story.append(Paragraph(
        'Berliner Beauftragte fuer Datenschutz und Informationsfreiheit<br/>'
        'Friedrichstr. 219, 10969 Berlin — www.datenschutz-berlin.de', S['Body']))

    # 10. Data Retention Summary
    story.append(Paragraph('10. Data Retention Summary', S['SectionHead']))
    story.append(Paragraph(
        'Session tokens: 7 days (sliding) or until logout. '
        'IP logs: 90 days. '
        'User profile/favourites/settings/feedback/redemptions: until account deletion. '
        'Impressions: 180 days. '
        'Newsletter: until unsubscribe. '
        'Transaction records: 10 years (pseudonymised). '
        'Tombstone hash: 3 years. '
        'Moderation logs: indefinite (anonymised on deletion).', S['Body']))

    # 11. Contact
    story.append(Paragraph('11. Contact', S['SectionHead']))
    story.append(Paragraph(
        'Privacy concerns and data requests: TaLK page (inquire.html) or arts4berlin@outlook.com.', S['Body']))

    doc.build(story, onFirstPage=lambda c, d: _footer(c, d, footer_text),
              onLaterPages=lambda c, d: _footer(c, d, footer_text))
    print(f'  [OK] {path}')


# ─────────────────────────────────────────
# 2. Terms of Service PDF
# ─────────────────────────────────────────

def generate_terms_of_service():
    path = os.path.join(OUT_DIR, 'terms-of-service.pdf')
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=25*mm)
    story = []
    S = styles
    footer_text = '4-arts.com'

    story.append(Paragraph('[aRTS] — Terms of Service', S['DocTitle']))
    story.append(Paragraph('Listing Terms & Bot Operations Terms | Effective March 2026', S['DocSubtitle']))

    # ── Part 1: Listing Terms ──
    story.append(Paragraph('PART I — LISTING TERMS', S['SectionHead']))

    listing_sections = [
        ('Rights Warranty',
         'You warrant that you are the rightful owner or authorized representative of the artwork listed on [aRTS]. By submitting a listing, you confirm that you hold all necessary rights, titles, and permissions to offer the work for sale or display through this platform.'),
        ('Authenticity Attestation',
         'You attest that all information provided in your listing is accurate and that the artwork is authentic. Misrepresentation of authorship, provenance, medium, dimensions, or condition may result in immediate removal and account suspension.'),
        ('Commission Terms',
         'Commission rates by membership tier: aUDIENCE (free) 20%, aLLY (0.55 EUR/mo) 15%, BRIGaDIER (3.3 EUR/mo) 10%, CURaTOR (33 EUR/mo) 7%. Commission is deducted at the time of sale. Remaining balance is paid to the seller\'s connected Stripe account within 2-3 business days.'),
        ('Payment Processing',
         'All payments are processed by Stripe. Sellers must connect a Stripe Express account. Stripe collects identity and banking information directly — [aRTS] does not see, store, or process financial or identity data.'),
        ('Payout Timeline',
         'Seller payouts are initiated automatically by Stripe. Funds arrive within 2-3 business days. [aRTS] does not hold funds.'),
        ('Refunds',
         'Buyers may request a refund within 14 days of purchase via the TaLK page. Full purchase amount is returned to the buyer. Platform commission is non-refundable on refunded sales (waivers at aRTS discretion).'),
        ('Liability',
         '[aRTS] facilitates transactions between buyers and sellers via Stripe. [aRTS] does not guarantee completion, quality, or outcome of transactions and assumes no liability for disputes.'),
        ('Removal',
         '[aRTS] reserves the right to remove any listing that violates these terms, infringes IP rights, or is otherwise deemed inappropriate.'),
        ('Session Data & Identity',
         'Your OAuth identifier is stored in hashed form. IP address is logged at listing submission for fraud prevention and audit. Data handled per Privacy Policy.'),
    ]

    for title, body in listing_sections:
        story.append(Paragraph(title, S['BodyBold']))
        story.append(Paragraph(body, S['Body']))

    story.append(Spacer(1, 20))

    # ── Part 2: Bot Terms ──
    story.append(Paragraph('PART II — BOT OPERATIONS TERMS', S['SectionHead']))

    bot_sections = [
        ('01 — Overview',
         '[aRTS] Bot Operations provides automated agents that monitor listings, flag opportunities, and surface intelligence across art markets and trade networks. By activating bot services you agree to these terms.'),
        ('02 — What Bots Do',
         'Monitor public art market listings and pricing signals. Cross-reference trade histories and provenance data. Flag artworks matching your preference profile. Scan images for prohibited content before publication. Deliver intelligence reports to your dashboard.'),
        ('03 — What Bots Do Not Do',
         'Bots do not execute transactions or commit funds. Do not access private third-party accounts. Do not store personal data beyond your session. Do not interact with any system without your activation.'),
        ('04 — Data & Privacy',
         'Bot Operations processes only data you explicitly direct it to. No background collection. All analysis performed on publicly available or member-provided sources. Preference profile stored locally.'),
        ('05 — Authorized Use',
         'Provided exclusively for member use within [aRTS]. Redistribution, reverse engineering, or bulk data harvesting is prohibited.'),
        ('06 — Liability',
         'Intelligence surfaced by bots is informational only. [aRTS] accepts no liability for decisions based on bot reports. Market data may be incomplete or delayed.'),
        ('07 — Content Moderation',
         'Content Moderator scans images prior to publication. Analysis occurs within [aRTS]. Flagged content held for moderator review. No external routing.'),
        ('08 — Changes',
         'Terms may be updated. Continued use constitutes acceptance. You will be prompted to re-accept on material changes.'),
    ]

    for title, body in bot_sections:
        story.append(Paragraph(title, S['BodyBold']))
        story.append(Paragraph(body, S['Body']))

    story.append(Spacer(1, 20))
    story.append(Paragraph('Contact: TaLK page (inquire.html) or arts4berlin@outlook.com', S['Body']))

    doc.build(story, onFirstPage=lambda c, d: _footer(c, d, footer_text),
              onLaterPages=lambda c, d: _footer(c, d, footer_text))
    print(f'  [OK] {path}')


# ─────────────────────────────────────────
# 3. Data Processing Overview PDF
# ─────────────────────────────────────────

def generate_data_processing_overview():
    path = os.path.join(OUT_DIR, 'data-processing-overview.pdf')
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=20*mm, bottomMargin=25*mm)
    story = []
    S = styles
    footer_text = '4-arts.com'

    story.append(Paragraph('[aRTS] — Data Processing Overview', S['DocTitle']))
    story.append(Paragraph('Record of Processing Activities pursuant to GDPR Art. 30 | Last updated: 15 March 2026', S['DocSubtitle']))

    # Table data
    header = ['Data Category', 'What We Store', 'Where', 'Legal Basis', 'Retention', 'Your Rights']
    TC = S['TableCell']
    TH = S['TableHeader']

    rows = [
        ['Authentication', 'User ID hash, email (enc), name (enc), OAuth sub (enc), password hash',
         'Server DB (Hetzner, EU)', 'Contract Art. 6(1)(b)', 'Until deletion', 'Access, rectify, erase, port'],
        ['Session tokens', 'SHA-256 token hash, user_id_hash, expiry',
         'Server DB + browser localStorage', 'Contract Art. 6(1)(b)', '7 days sliding', 'Erase (logout)'],
        ['IP logs', 'Encrypted IP, provider, tier, timestamp, encrypted UA',
         'Server DB (Hetzner, EU)', 'Legit. interest Art. 6(1)(f)', '90 days', 'Access, erase, object'],
        ['Profile & prefs', 'Alias, tier, join date, XP, settings (enc)',
         'Server DB + localStorage', 'Contract Art. 6(1)(b)', 'Until deletion', 'Access, rectify, erase, port'],
        ['Favourites', 'Piece IDs; client-side AES-GCM encrypted',
         'Server DB + localStorage', 'Contract Art. 6(1)(b)', 'Until deletion', 'Access, erase, port'],
        ['Feedback', 'Rating, text (enc), page',
         'Server DB', 'Consent Art. 6(1)(a)', 'Until deletion', 'Access, erase, withdraw consent'],
        ['Newsletter', 'Email (enc), name (enc), source',
         'Server DB', 'Consent Art. 6(1)(a)', 'Until unsub', 'Erase, withdraw consent'],
        ['Payments', 'Transaction ID, amount, commission (no card data)',
         'Server DB + Stripe', 'Contract + Legal obl.', '10 years (tax)', 'Access (pseudonymised)'],
        ['Impressions', 'User-piece interactions, duration, source',
         'Server DB', 'Legit. interest Art. 6(1)(f)', '180 days', 'Access, erase, object'],
        ['Recommendations', 'Cached recs, click-through tracking',
         'Server DB', 'Legit. interest Art. 6(1)(f)', 'Regenerated', 'Access, erase, object'],
        ['Moderation', 'Listing metadata, AI verdicts, scores',
         'Server DB', 'Legit. interest Art. 6(1)(f)', 'Indefinite (anon)', 'Human review (Art. 22)'],
        ['Forms', 'Inquiry content, reports',
         'Formspree (US)', 'Consent Art. 6(1)(a)', 'Per Formspree', 'Erase, withdraw consent'],
        ['Tombstone', 'Double-hashed ID (non-reversible)',
         'Server DB', 'Legit. interest Art. 6(1)(f)', '3 years', 'N/A (non-identifiable)'],
    ]

    # Build table with Paragraph objects for word wrapping
    table_data = [[Paragraph(h, TH) for h in header]]
    for row in rows:
        table_data.append([Paragraph(cell, TC) for cell in row])

    col_widths = [28*mm, 38*mm, 28*mm, 28*mm, 22*mm, 30*mm]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#CCCCCC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#FFFFFF'), BG_GREY]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))

    story.append(table)
    story.append(Spacer(1, 20))

    # Third-party processors
    story.append(Paragraph('Third-Party Processors (GDPR Art. 28)', S['SectionHead']))
    processors = [
        ['Processor', 'Purpose', 'Location', 'Transfer Safeguard'],
        ['Stripe, Inc.', 'Payment processing', 'US/EU', 'EU-US DPF + SCCs'],
        ['Cloudflare, Inc.', 'CDN, DDoS, DNS', 'US/EU', 'EU-US DPF + SCCs'],
        ['Hetzner Online GmbH', 'VPS hosting', 'Finland (EU)', 'N/A (EU)'],
        ['Formspree, Inc.', 'Form submissions', 'US', 'SCCs'],
        ['Google LLC', 'OAuth authentication', 'US', 'EU-US DPF'],
        ['Apple Inc.', 'Sign In with Apple', 'US', 'EU-US DPF'],
        ['Resend, Inc.', 'Transactional email', 'US', 'SCCs'],
    ]

    proc_data = [[Paragraph(cell, TH if i == 0 else TC) for cell in row] for i, row in enumerate(processors)]
    proc_table = Table(proc_data, colWidths=[40*mm, 40*mm, 35*mm, 55*mm], repeatRows=1)
    proc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), HexColor('#FFFFFF')),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#CCCCCC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#FFFFFF'), BG_GREY]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(proc_table)

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        '<b>Deletion process:</b> Account deletion via iD dashboard triggers immediate erasure of all personal data. '
        'Transaction records pseudonymised (10 years, tax law). Non-reversible tombstone hash retained (3 years, fraud prevention). '
        'Supervisory authority: Berliner Beauftragte fuer Datenschutz und Informationsfreiheit, Friedrichstr. 219, 10969 Berlin.',
        S['Body']))

    doc.build(story, onFirstPage=lambda c, d: _footer(c, d, footer_text),
              onLaterPages=lambda c, d: _footer(c, d, footer_text))
    print(f'  [OK] {path}')


if __name__ == '__main__':
    print('[aRTS] Generating legal PDFs...')
    generate_privacy_policy()
    generate_terms_of_service()
    generate_data_processing_overview()
    print('[aRTS] Done — 3 PDFs generated.')
