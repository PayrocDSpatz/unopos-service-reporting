// src/utils/parseTickets.js
// Supports both normal CSV exports and HESK Excel XML Spreadsheet exports.

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTicket(row) {
  return {
    id: clean(row["#"]),
    trackingId: clean(row["Tracking ID"]),
    date: clean(row["Date"]),
    updated: clean(row["Updated"]),
    merchant: clean(row["Name"]),
    email: clean(row["Email"]),
    category: clean(row["Category"]),
    priority: clean(row["Priority"]),
    status: clean(row["Status"]),
    subject: clean(row["Subject"]),
    message: clean(row["Message"]),
    owner: clean(row["Owner"]) || "Unassigned",
    timeWorked: clean(row["Time worked"]),
    phoneNumber: clean(row["Phone Number"]),
    cityState: clean(row["City/State"]),
    contact: clean(row["Contact"]),
  };
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map(clean);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? "");
    return normalizeTicket(row);
  });
}

function parseHeskExcelXml(text) {
  const xml = new DOMParser().parseFromString(text, "application/xml");

  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid XML file. Please export again from HESK.");
  }

  const rows = Array.from(xml.getElementsByTagNameNS(
    "urn:schemas-microsoft-com:office:spreadsheet",
    "Row"
  ));

  if (!rows.length) {
    throw new Error("No rows found. This does not look like a HESK Excel XML export.");
  }

  const getCells = (row) => Array.from(row.getElementsByTagNameNS(
    "urn:schemas-microsoft-com:office:spreadsheet",
    "Cell"
  ));

  const getText = (cell) => {
    const data = cell.getElementsByTagNameNS(
      "urn:schemas-microsoft-com:office:spreadsheet",
      "Data"
    )[0];
    return data?.textContent ?? "";
  };

  const firstRow = getCells(rows[0]);
  const headers = firstRow.map(getText).map(clean);

  const tickets = [];

  for (const row of rows.slice(1)) {
    const cells = getCells(row);
    const values = new Array(headers.length).fill("");

    let colIndex = 0;

    cells.forEach((cell) => {
      // SpreadsheetML can skip columns using ss:Index. Handle that safely.
      const ssIndex =
        cell.getAttribute("ss:Index") ||
        cell.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Index");

      if (ssIndex) colIndex = Number(ssIndex) - 1;

      values[colIndex] = getText(cell);
      colIndex++;
    });

    const rowObj = {};
    headers.forEach((header, i) => rowObj[header] = values[i] ?? "");

    if (Object.values(rowObj).some(v => clean(v))) {
      tickets.push(normalizeTicket(rowObj));
    }
  }

  return tickets;
}

export async function parseTicketFile(file) {
  const text = await file.text();
  const name = file.name.toLowerCase();

  if (name.endsWith(".xml") || text.trim().startsWith("<?xml") || text.includes("<Workbook")) {
    return parseHeskExcelXml(text);
  }

  return parseCsv(text);
}

export function summarizeTickets(tickets) {
  const byStatus = {};
  const byOwner = {};
  const byCategory = {};
  let totalSeconds = 0;

  for (const t of tickets) {
    byStatus[t.status || "Blank"] = (byStatus[t.status || "Blank"] || 0) + 1;
    byOwner[t.owner || "Unassigned"] = (byOwner[t.owner || "Unassigned"] || 0) + 1;
    byCategory[t.category || "Blank"] = (byCategory[t.category || "Blank"] || 0) + 1;

    const parts = String(t.timeWorked || "00:00:00").split(":").map(Number);
    if (parts.length === 3 && parts.every(n => !Number.isNaN(n))) {
      totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  return {
    totalTickets: tickets.length,
    resolved: byStatus["Resolved"] || 0,
    replied: byStatus["Replied"] || 0,
    newTickets: byStatus["New"] || 0,
    byStatus,
    byOwner,
    byCategory,
    totalTimeWorkedSeconds: totalSeconds,
  };
}
