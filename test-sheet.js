import XLSX from 'xlsx';

async function test() {
  const url = 'https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx';
  console.log("Fetching sheet from URL...");
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    console.log("SUCCESS! Sheet names:", wb.SheetNames);
    
    // Inspect each sheet's headers
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`\n--- Sheet: ${name} ---`);
      console.log(`Rows: ${data.length}`);
      
      // Let's find some potential header rows
      const scanRows = Math.min(data.length, 10);
      for (let r = 0; r < scanRows; r++) {
        const row = data[r];
        if (row && row.length > 0) {
          const filledCount = row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').length;
          if (filledCount > 3) {
            console.log(`Row ${r} (${filledCount} filled cells):`, row.slice(0, 15).map(c => String(c).trim()).filter(Boolean));
          }
        }
      }
    }
  } catch (err) {
    console.error("ERROR fetching or parsing sheet:", err);
  }
}

test();
