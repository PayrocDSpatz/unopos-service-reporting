import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';
import { parseExcelExport } from './parseExcelExport.js';

function clean(value) {
  return String(value ?? '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function pick(obj, names) {
  for (const name of names) {
    if (obj?.[name] != null) {
      const value = Array.isArray(obj[name]) ? obj[name][0] : obj[name];
      if (typeof value === 'object' && value?._ != null) return clean(value._);
      return clean(value);
    }
  }
  return '';
}

function parseMessageField(message = '') {
  const out = {};
  const lines = clean(message).split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([^:]+)\s*:\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === 'who') out.who = value;
    if (key === 'role') out.role = value;
    if (key === 'what') out.what = value;
    if (key === 'when') out.when = value;
  }
  return out;
}

function getCellText(cell) {
  const data = cell?.Data?.[0];
  if (data == null) return '';
  if (typeof data === 'string') return clean(data);
  if (typeof data === 'object') return clean(data._ ?? '');
  return clean(data);
}

function getSpreadsheetRows(parsed) {
  const workbook = parsed?.Workbook;
  const worksheets = workbook?.Worksheet || [];
  const rows = [];

  for (const ws of worksheets) {
    const table = ws?.Table?.[0];
    const rawRows = table?.Row || [];
    for (const row of rawRows) {
      const cells = row?.Cell || [];
      const values = [];
      let colIndex = 0;

      // Excel XML sometimes uses ss:Index to skip empty cells. Preserve column positions.
      for (const cell of cells) {
        const idx = cell?.['ss:Index']?.[0] || cell?.Index?.[0];
        if (idx) colIndex = Number(idx) - 1;
        values[colIndex] = getCellText(cell);
        colIndex += 1;
      }
      rows.push(values.map(v => v || ''));
    }
  }
  return rows;
}

function parseSpreadsheetTickets(parsed) {
  const rows = getSpreadsheetRows(parsed);
  if (rows.length < 2) return [];

  const header = rows[0].map(h => clean(h));
  const headerMap = new Map(header.map((h, i) => [h.toLowerCase(), i]));
  const get = (row, name) => row[headerMap.get(name.toLowerCase())] || '';

  return rows.slice(1)
    .filter(row => row.some(Boolean))
    .map((row, index) => {
      const message = get(row, 'Message');
      const msg = parseMessageField(message);
      const contact = get(row, 'Contact') || msg.who;
      const role = msg.role;

      return {
        ticketNumber: get(row, '#'),
        trackingId: get(row, 'Tracking ID'),
        createdAt: get(row, 'Date'),
        updatedAt: get(row, 'Updated'),
        merchant: get(row, 'Name') || `Ticket ${index + 1}`,
        email: get(row, 'Email'),
        category: get(row, 'Category'),
        priority: get(row, 'Priority') || 'Not listed',
        status: get(row, 'Status') || 'Not listed',
        subject: get(row, 'Subject') || msg.what,
        issue: msg.what || get(row, 'Subject'),
        notes: message,
        assignedTo: get(row, 'Owner') || 'Unassigned',
        timeWorked: get(row, 'Time worked') || '00:00:00',
        phone: get(row, 'Phone Number'),
        cityState: get(row, 'City/State'),
        contact: role && contact ? `${contact} (${role})` : contact
      };
    })
    .filter(t => t.trackingId || t.merchant || t.subject || t.notes);
}

function findTicketArrays(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      if (key.toLowerCase().includes('ticket')) found.push(value);
      value.forEach(v => findTicketArrays(v, found));
    } else if (typeof value === 'object') {
      findTicketArrays(value, found);
    }
  }
  return found;
}

function normalizeTicket(raw, index) {
  const notes = pick(raw, ['message', 'messages', 'history', 'reply', 'replies', 'notes', 'dtl', 'body']);
  const msg = parseMessageField(notes);
  const subject = pick(raw, ['subject', 'title']) || msg.what;
  const issue = pick(raw, ['what', 'issue', 'problem']) || msg.what || subject;
  const merchant = pick(raw, ['name', 'merchant', 'customer', 'client']) || `Ticket ${index + 1}`;
  const contact = pick(raw, ['contact', 'who', 'person']) || msg.who;
  const role = pick(raw, ['role']) || msg.role;

  return {
    trackingId: pick(raw, ['trackid', 'tracking_id', 'trackingid', 'track', 'id']),
    createdAt: pick(raw, ['dt', 'date', 'created', 'created_on', 'date_created']),
    updatedAt: pick(raw, ['lastchange', 'updated', 'updated_on', 'date_updated']),
    merchant,
    contact: role && contact ? `${contact} (${role})` : contact,
    phone: pick(raw, ['phone', 'phone_number', 'telephone']),
    category: pick(raw, ['category', 'cat_name']),
    priority: pick(raw, ['priority', 'priority_name']) || 'Not listed',
    status: pick(raw, ['status', 'status_name']) || 'Not listed',
    subject,
    issue,
    assignedTo: pick(raw, ['owner', 'assigned_to', 'assignedto', 'staff', 'name_assigned']) || 'Unassigned',
    timeWorked: pick(raw, ['time_worked', 'timeworked', 'time_worked_formatted']) || '00:00:00',
    notes
  };
}

export async function extractFileFromUpload(fileBuffer, fileName) {
  const lowerName = (fileName || '').toLowerCase();

  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(fileBuffer);
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
    const supportedName = names.find(name => /\.(xml|xlsx|xls|csv)$/i.test(name));
    if (!supportedName) throw new Error('No XML, Excel, or CSV file found inside ZIP export.');

    const innerLower = supportedName.toLowerCase();
    if (innerLower.endsWith('.xml') || innerLower.endsWith('.csv')) {
      return { type: innerLower.split('.').pop(), text: await zip.files[supportedName].async('string') };
    }
    return { type: innerLower.split('.').pop(), buffer: await zip.files[supportedName].async('nodebuffer') };
  }

  if (lowerName.endsWith('.xml') || lowerName.endsWith('.csv')) {
    return { type: lowerName.split('.').pop(), text: fileBuffer.toString('utf8') };
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    return { type: lowerName.split('.').pop(), buffer: fileBuffer };
  }

  throw new Error('Unsupported file type. Upload XML, ZIP, XLSX, XLS, or CSV.');
}

export async function extractXmlFromUpload(fileBuffer, fileName) {
  const extracted = await extractFileFromUpload(fileBuffer, fileName);
  if (extracted.type !== 'xml') throw new Error('Uploaded file is not XML. Use parseUploadedHeskFile for XML, ZIP, Excel, or CSV imports.');
  return extracted.text;
}

export async function parseUploadedHeskFile(fileBuffer, fileName) {
  const extracted = await extractFileFromUpload(fileBuffer, fileName);
  if (['xlsx', 'xls'].includes(extracted.type)) return parseExcelExport(extracted.buffer);
  if (extracted.type === 'csv') return parseExcelExport(Buffer.from(extracted.text, 'utf8'));
  return parseHeskExport(extracted.text);
}

export async function parseHeskExport(xmlText) {
  const parsed = await parseStringPromise(xmlText, {
    explicitArray: true,
    mergeAttrs: true,
    trim: true,
    explicitCharkey: true
  });

  // HESK export is often Excel 2003 XML: Workbook > Worksheet > Table > Row > Cell.
  const spreadsheetTickets = parseSpreadsheetTickets(parsed);
  if (spreadsheetTickets.length) return spreadsheetTickets;

  // Fallback for direct HESK ticket-style XML exports.
  const arrays = findTicketArrays(parsed).sort((a, b) => b.length - a.length);
  const rawTickets = arrays[0] || [];
  return rawTickets.map(normalizeTicket).filter(t => t.subject || t.merchant || t.trackingId || t.notes);
}
