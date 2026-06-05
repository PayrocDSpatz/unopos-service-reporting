# UNOPOS Dashboard XML Import Patch

This patch adds support for HESK Excel XML exports.

## Add this file

Place:

`src/utils/parseTickets.js`

into your repo.

## Update your file upload handler

Wherever your dashboard currently reads CSV files, replace the CSV-only logic with:

```js
import { parseTicketFile, summarizeTickets } from "./utils/parseTickets";

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const tickets = await parseTicketFile(file);
  const summary = summarizeTickets(tickets);

  setTickets(tickets);
  setSummary(summary);
}
```

## Why totals were zero

The HESK export is not regular XML and not CSV. It is Microsoft Excel Spreadsheet XML:

`Workbook > Worksheet > Table > Row > Cell > Data`

A normal CSV parser or generic XML parser will usually return no rows, causing dashboard metrics to show zeros.
