import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';

function pick(obj, names) {
  for (const name of names) {
    if (obj?.[name] != null) {
      const value = Array.isArray(obj[name]) ? obj[name][0] : obj[name];
      if (typeof value === 'object' && value?._) return String(value._).trim();
      return String(value ?? '').trim();
    }
  }
  return '';
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
  const subject = pick(raw, ['subject', 'title']);
  const issue = pick(raw, ['what', 'issue', 'problem']) || subject;
  const merchant = pick(raw, ['name', 'merchant', 'customer', 'client']) || `Ticket ${index + 1}`;

  return {
    trackingId: pick(raw, ['trackid', 'tracking_id', 'trackingid', 'track', 'id']),
    createdAt: pick(raw, ['dt', 'date', 'created', 'created_on', 'date_created']),
    updatedAt: pick(raw, ['lastchange', 'updated', 'updated_on', 'date_updated']),
    merchant,
    contact: pick(raw, ['contact', 'who', 'person']),
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

export async function extractXmlFromUpload(fileBuffer, fileName) {
  if (fileName.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(fileBuffer);
    const xmlFileName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.xml'));
    if (!xmlFileName) throw new Error('No XML file found inside ZIP export.');
    return await zip.files[xmlFileName].async('string');
  }
  return fileBuffer.toString('utf8');
}

export async function parseHeskExport(xmlText) {
  const parsed = await parseStringPromise(xmlText, { explicitArray: true, mergeAttrs: true, trim: true });
  const arrays = findTicketArrays(parsed).sort((a, b) => b.length - a.length);
  const rawTickets = arrays[0] || [];
  return rawTickets.map(normalizeTicket).filter(t => t.subject || t.merchant || t.trackingId);
}
