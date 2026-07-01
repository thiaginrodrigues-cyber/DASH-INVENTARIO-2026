export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sheetUrl =
      'https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx';

    const queryStr = new URLSearchParams(req.query).toString();
    const finalUrl = queryStr ? `${sheetUrl}&${queryStr}` : sheetUrl;

    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned status ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sheet.xlsx"');
    return res.send(buffer);
  } catch (error) {
    console.error('[Proxy] Error fetching sheet:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch Google Sheet via proxy',
    });
  }
}
