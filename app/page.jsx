'use client';

import { useState } from 'react';

function downloadFile(filename, mimeType, base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setStatus('Please select a HESK XML or ZIP export.');
      return;
    }

    setStatus('Generating email report file...');
    setReport(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/generate-report', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.');
      return;
    }

    setStatus('Report generated. Copy the email body or download the HTML/TXT file.');
    setReport(data);
  }

  async function copyHtml() {
    if (!report?.html) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([report.html], { type: 'text/html' }),
          'text/plain': new Blob([report.text], { type: 'text/plain' })
        })
      ]);
      setStatus('Formatted email copied. Paste it into Outlook/Gmail.');
    } catch {
      await navigator.clipboard.writeText(report.text);
      setStatus('Plain text copied. Your browser did not allow formatted HTML copy.');
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', background: '#fff', padding: 30, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
      <h1>UNOPOS Overnight Report Generator</h1>
      <p>Upload the daily HESK XML or ZIP export. The app generates an email-ready report you can manually send to Danny.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
        <label>
          <strong>HESK Export XML or ZIP</strong><br />
          <input type="file" accept=".xml,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        <button style={{ padding: 12, fontWeight: 700, cursor: 'pointer' }}>Generate Email Report</button>
      </form>

      {status && <p style={{ marginTop: 20, fontWeight: 700 }}>{status}</p>}

      {report && (
        <section style={{ marginTop: 24 }}>
          <h2>Email Subject</h2>
          <input readOnly value={report.subject} style={{ width: '100%', padding: 10 }} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button onClick={copyHtml} style={{ padding: 10, fontWeight: 700, cursor: 'pointer' }}>Copy Formatted Email Body</button>
            <button onClick={() => downloadFile('unopos-overnight-report.html', 'text/html', report.htmlBase64)} style={{ padding: 10, cursor: 'pointer' }}>Download HTML File</button>
            <button onClick={() => downloadFile('unopos-overnight-report.txt', 'text/plain', report.textBase64)} style={{ padding: 10, cursor: 'pointer' }}>Download Text File</button>
          </div>

          <h2 style={{ marginTop: 24 }}>Preview</h2>
          <ul>
            <li>Total Tickets: {report.preview.totalTickets}</li>
            <li>Management Highlights: {report.preview.highlightCount}</li>
            <li>Open/Follow-Up Items: {report.preview.openItems}</li>
          </ul>

          <div style={{ border: '1px solid #ddd', padding: 16, marginTop: 16, borderRadius: 8 }}>
            <iframe title="Report Preview" srcDoc={report.html} style={{ width: '100%', height: 650, border: 0 }} />
          </div>
        </section>
      )}
    </main>
  );
}
