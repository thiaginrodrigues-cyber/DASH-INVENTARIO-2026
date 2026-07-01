import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Route: Google Sheets Proxy to bypass browser CORS constraints
  app.get("/api/fetch-sheets", async (req, res) => {
    try {
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx";
      
      // Propagate cache buster params if present
      const queryStr = new URLSearchParams(req.query as any).toString();
      const finalUrl = queryStr ? `${sheetUrl}&${queryStr}` : sheetUrl;
      
      console.log(`[Proxy] Fetching Google Sheet: ${finalUrl}`);
      
      const response = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Google Sheets returned status ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="sheet.xlsx"');
      res.send(buffer);
    } catch (error: any) {
      console.error("[Proxy] Error fetching sheet:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Google Sheet via proxy" });
    }
  });

  // API Route: Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // For React/Vite SPAs, route all other paths to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
