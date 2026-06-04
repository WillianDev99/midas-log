import XLSX from 'xlsx';

try {
  console.log("Loading Excel...");
  const workbook = XLSX.readFile('public/SUPER PRIME 2026.xlsx');
  console.log("Sheets in workbook:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Let's convert sheet to JSON rows to see the first 10 rows and columns
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log("Total rows:", rawData.length);
  
  console.log("Row 0:", rawData[0]?.slice(0, 15));
  console.log("Row 1:", rawData[1]?.slice(0, 15));
  console.log("Row 2:", rawData[2]?.slice(0, 15));
  console.log("Row 3:", rawData[3]?.slice(0, 15));
  console.log("Row 4:", rawData[4]?.slice(0, 15));
  console.log("Row 5:", rawData[5]?.slice(0, 15));
  console.log("Row 6:", rawData[6]?.slice(0, 15));
  console.log("Row 7:", rawData[7]?.slice(0, 15));
  console.log("Row 8:", rawData[8]?.slice(0, 15));
  console.log("Row 9:", rawData[9]?.slice(0, 15));
  console.log("Row 10:", rawData[10]?.slice(0, 15));
  
  // Let's find column indices of interest.
  // The user says "Na coluna C temos o nome do produto"
  // Let's find some columns
  const headerRow = rawData[0]; // usually row 0 is header
  console.log("Header Columns Count:", headerRow ? headerRow.length : 0);
  if (headerRow) {
    console.log("First 20 headers:");
    for (let i = 0; i < Math.min(headerRow.length, 25); i++) {
      console.log(`Col ${i} (${XLSX.utils.encode_col(i)}):`, headerRow[i]);
    }
    
    // Find column with "Preço#"
    const priceCols = [];
    for (let i = 0; i < headerRow.length; i++) {
      if (typeof headerRow[i] === 'string' && headerRow[i].startsWith('Preço#')) {
        priceCols.push({ index: i, name: headerRow[i] });
      }
    }
    console.log(`Found ${priceCols.length} price columns:`);
    console.log("First 5 price columns:", priceCols.slice(0, 5));
    console.log("Last 5 price columns:", priceCols.slice(-5));
  }
} catch (err) {
  console.error("Error:", err);
}
