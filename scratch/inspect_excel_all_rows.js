import XLSX from 'xlsx';

try {
  const workbook = XLSX.readFile('public/SUPER PRIME 2026.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log("Total rows:", rows.length);
  
  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[2]; // Column C
    if (name) {
      products.push(name);
    }
  }
  
  console.log("Sample of 20 products from Excel:");
  console.log(products.slice(0, 20));
  
  // Analyze formats and levels in Excel products
  const formats = new Set();
  const levels = new Set();
  
  products.forEach(p => {
    // Regex to extract format like 100x100, 56x56
    const formatMatch = p.match(/\b\d+(?:[\.,]\d+)?\s*[xX]\s*\d+(?:[\.,]\d+)?\b/);
    if (formatMatch) {
      formats.add(formatMatch[0].replace(/\s+/g, ''));
    }
    
    const levelMatch = p.match(/-\s*N(\d+)/i);
    if (levelMatch) {
      levels.add(levelMatch[1]);
    }
  });
  
  console.log("Formats found in Excel:", Array.from(formats));
  console.log("Levels found in Excel:", Array.from(levels).sort());
  
} catch (err) {
  console.error(err);
}
