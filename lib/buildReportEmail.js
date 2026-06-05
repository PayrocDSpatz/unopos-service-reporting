import { shouldHighlight, inferBusinessImpact, needsFollowUp } from './highlightRules';

function esc(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function shortIssue(ticket) {
  const base = ticket.subject || ticket.issue || 'Support request';
  return base.length > 90 ? base.slice(0, 87) + '...' : base;
}

function row(cells) {
  return `<tr>${cells.map(c => `<td style="border:1px solid #ddd;padding:6px;vertical-align:top;">${c}</td>`).join('')}</tr>`;
}

function header(cells) {
  return `<tr>${cells.map(c => `<th style="border:1px solid #ddd;padding:7px;background:#f1f3f5;text-align:left;">${c}</th>`).join('')}</tr>`;
}

export function buildReportEmail(tickets) {
  const highlights = tickets.filter(shouldHighlight);
  const followUps = tickets.filter(needsFollowUp);
  const resolved = tickets.filter(t => (t.status || '').toLowerCase().includes('resolved')).length;
  const replied = tickets.filter(t => (t.status || '').toLowerCase().includes('replied')).length;
  const open = tickets.length - resolved - replied;
  const priorityCounts = tickets.reduce((acc, t) => {
    const p = t.priority || 'Not listed';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const subject = `UNOPOS Overnight Operations Report - ${new Date().toLocaleDateString('en-US')}`;

  const html = `
  <div style="font-family:Arial,sans-serif;color:#222;line-height:1.35;">
    <h1 style="margin-bottom:4px;">UNOPOS Overnight Operations Report</h1>
    <p style="margin-top:0;color:#555;">Generated from HESK export</p>

    <h2>Executive Summary</h2>
    <table style="border-collapse:collapse;width:100%;max-width:720px;">
      ${header(['Metric','Value'])}
      ${row(['Tickets Reviewed', esc(tickets.length)])}
      ${row(['Management Highlights', esc(highlights.length)])}
      ${row(['Open / Follow-Up Items', esc(followUps.length)])}
      ${row(['Resolved', esc(resolved)])}
      ${row(['Replied', esc(replied)])}
      ${row(['Other/Open/New', esc(open)])}
      ${row(['Priority Breakdown', esc(Object.entries(priorityCounts).map(([k,v]) => `${k}: ${v}`).join(', '))])}
    </table>

    <h2>Management Highlights</h2>
    ${highlights.length ? highlights.map(t => `
      <div style="border:1px solid #ddd;border-left:5px solid #b42318;padding:10px;margin:10px 0;">
        <strong>${esc(t.merchant)}</strong><br>
        <strong>Priority:</strong> ${esc(t.priority)} &nbsp; <strong>Status:</strong> ${esc(t.status)} &nbsp; <strong>Owner:</strong> ${esc(t.assignedTo)}<br>
        <strong>Issue:</strong> ${esc(shortIssue(t))}<br>
        <strong>Business Impact:</strong> ${esc(inferBusinessImpact(t))}<br>
        <strong>Current Notes:</strong> ${esc(t.notes || t.issue || 'No detailed notes found in export.')}
      </div>
    `).join('') : '<p>No management-highlight tickets identified.</p>'}

    <h2>Open Items Requiring Attention</h2>
    <table style="border-collapse:collapse;width:100%;">
      ${header(['Priority','Merchant','Contact','Owner','Next Action / Reason'])}
      ${followUps.map(t => row([
        esc(t.priority), esc(t.merchant), esc(t.contact || 'N/A'), esc(t.assignedTo), esc(t.notes || shortIssue(t))
      ])).join('') || row(['','','','', 'No open follow-up items identified.'])}
    </table>

    <h2>All Ticket Activity</h2>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      ${header(['Priority','Date/Time','Merchant','Contact','Owner','Issue Summary','Status'])}
      ${tickets.map(t => row([
        esc(t.priority), esc(t.createdAt), esc(t.merchant), esc(t.contact || 'N/A'), esc(t.assignedTo), esc(shortIssue(t)), esc(t.status)
      ])).join('')}
    </table>
  </div>`;

  const text = `UNOPOS Overnight Operations Report\n\nTickets Reviewed: ${tickets.length}\nManagement Highlights: ${highlights.length}\nOpen / Follow-Up Items: ${followUps.length}`;

  return { subject, html, text, preview: { totalTickets: tickets.length, highlightCount: highlights.length, openItems: followUps.length } };
}
