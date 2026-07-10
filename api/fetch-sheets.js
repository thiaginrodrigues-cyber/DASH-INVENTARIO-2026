export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Priority: explicit `url` query param -> SHEET_EXPORT_URL env -> SPREADSHEET_ID env -> hardcoded fallback
    const urlFromQuery = req.query && req.query.url ? String(req.query.url) : null;
    const sheetExportUrlEnv = process.env.SHEET_EXPORT_URL || null;
    const spreadsheetIdEnv = process.env.SPREADSHEET_ID || null;

    let sheetUrl = null;
    if (urlFromQuery) {
      sheetUrl = urlFromQuery;
    } else if (sheetExportUrlEnv) {
      sheetUrl = sheetExportUrlEnv;
    } else if (spreadsheetIdEnv) {
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetIdEnv}/export?format=xlsx`;
    } else {
      sheetUrl = 'https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx';
    }

    const queryStr = new URLSearchParams(Object.assign({}, req.query));
    // Remove `url` from query params if present to avoid duplicating
    if (queryStr.has('url')) queryStr.delete('url');
    const finalUrl = queryStr.toString() ? `${sheetUrl}&${queryStr.toString()}` : sheetUrl;

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
