# UNOPOS Overnight Report Generator

Private Next.js app for uploading a daily HESK XML or ZIP export and generating an email-ready overnight support summary.

This version does **not** send email through Resend or any email provider. It creates a report that can be copied and pasted into Outlook/Gmail or downloaded as HTML/TXT for manual sending.

## What it does

- Accepts HESK XML or ZIP exports
- Extracts ticket fields
- Applies POS/payments highlight rules
- Builds an executive-style email body
- Shows a preview in the browser
- Provides:
  - Copy formatted email body
  - Download HTML file
  - Download TXT file

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Daily workflow

1. Export HESK tickets as XML or ZIP.
2. Upload the file.
3. Click **Generate Email Report**.
4. Copy the subject.
5. Click **Copy Formatted Email Body**.
6. Paste into an email to Danny.
7. Send manually.

## Deploy to Vercel

- Push this repo to GitHub.
- Import into Vercel.
- Protect the page with Vercel password protection or add authentication before production use.
- No environment variables are required.

## Highlight rules

Tickets are promoted to Management Highlights when they contain operationally important terms such as:

- internet outage
- network down
- EMV/card reader failure
- payment terminal down
- PAX device failure
- online ordering issue
- menu mapping causing wrong customer order
- dispute/chargeback
- refund failure
- unassigned ticket
- escalation/replacement/follow-up required

All tickets are still included in the All Ticket Activity table.
