import * as XLSX from 'xlsx';

function clean(value) {
  return String(value ?? '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getByHeader(row, headerMap, names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    const actual = headerMap.get(key);
    if (actual && row[actual] != null && clean(row[actual]) !== '') return clean(row[actual]);
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

function excelDateToText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: 'numeric', minute: '2-digit'
    });
  }
  return clean(value);
}

export function parseExcelExport(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  if (!rows.length) return [];

  const headers = Object.keys(rows[0] || {});
  const headerMap = new Map(headers.map(h => [normalizeHeader(h), h]));

  return rows
    .map((row, index) => {
      const message = getByHeader(row, headerMap, ['Message', 'Notes', 'Body', 'Resolution', 'Replies']);
      const msg = parseMessageField(message);
      const contact = getByHeader(row, headerMap, ['Contact', 'Who', 'Contact Name']) || msg.who;
      const role = getByHeader(row, headerMap, ['Role']) || msg.role;
      const subject = getByHeader(row, headerMap, ['Subject', 'Title']) || msg.what;
      const issue = getByHeader(row, headerMap, ['Issue', 'What', 'Problem']) || msg.what || subject;

      return {
        ticketNumber: getByHeader(row, headerMap, ['#', 'Ticket #', 'Ticket Number']),
        trackingId: getByHeader(row, headerMap, ['Tracking ID', 'Track ID', 'TrackingID']),
        createdAt: excelDateToText(getByHeader(row, headerMap, ['Date', 'Created', 'Created On', 'Date Created'])),
        updatedAt: excelDateToText(getByHeader(row, headerMap, ['Updated', 'Last Updated', 'Date Updated'])),
        merchant: getByHeader(row, headerMap, ['Name', 'Merchant', 'Customer', 'Client']) || `Ticket ${index + 1}`,
        email: getByHeader(row, headerMap, ['Email', 'Email Address']),
        category: getByHeader(row, headerMap, ['Category']),
        priority: getByHeader(row, headerMap, ['Priority']) || 'Not listed',
        status: getByHeader(row, headerMap, ['Status']) || 'Not listed',
        subject,
        issue,
        notes: message,
        assignedTo: getByHeader(row, headerMap, ['Owner', 'Assigned To', 'Assigned', 'Staff']) || 'Unassigned',
        timeWorked: getByHeader(row, headerMap, ['Time worked', 'Time Worked', 'Time']) || '00:00:00',
        phone: getByHeader(row, headerMap, ['Phone Number', 'Phone', 'Telephone']),
        cityState: getByHeader(row, headerMap, ['City/State', 'City State', 'Location']),
        contact: role && contact ? `${contact} (${role})` : contact
      };
    })
    .filter(t => t.trackingId || t.merchant || t.subject || t.notes);
}
