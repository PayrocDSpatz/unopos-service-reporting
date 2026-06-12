import { parseUploadedHeskFile } from '../../../lib/parseHeskExport';
import { buildReportEmail } from '../../../lib/buildReportEmail';

export const runtime = 'nodejs';

function toBase64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tickets = await parseUploadedHeskFile(buffer, file.name || 'upload');
    const report = buildReportEmail(tickets);

    return Response.json({
      ok: true,
      subject: report.subject,
      html: report.html,
      text: report.text,
      htmlBase64: toBase64(report.html),
      textBase64: toBase64(report.text),
      preview: report.preview
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to generate report.' }, { status: 500 });
  }
}
