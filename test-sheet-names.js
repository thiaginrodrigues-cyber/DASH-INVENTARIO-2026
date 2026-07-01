import XLSX from 'xlsx';

async function test() {
  const url = 'https://docs.google.com/spreadsheets/d/1tnl6iGFhO87pd0wYPnmOVoCSXJp10xwvSqagHrwTr-s/export?format=xlsx';
  console.log("Fetching sheet from URL...");
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    console.log("ALL SHEET NAMES IN WORKBOOK:", wb.SheetNames);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
