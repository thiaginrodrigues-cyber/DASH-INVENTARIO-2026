import XLSX from 'xlsx';

async function test() {
  const url = 'https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx';
  console.log("Fetching sheet from URL...");
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const name = 'INVENTARIO GT';
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- Sheet: ${name} ---`);
    console.log(`Rows: ${data.length}`);
    
    // Scan first 15 rows to see what is in them
    const scanRows = Math.min(data.length, 15);
    for (let r = 0; r < scanRows; r++) {
      const row = data[r];
      if (row) {
        console.log(`Row ${r}:`, row.slice(0, 15));
      }
    }
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
