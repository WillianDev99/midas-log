const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'DEV', 'MIDAS RENT A CAR', 'midas-log', 'public', 'BASE.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`Searching in sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    data.forEach((row, i) => {
      if (row.some(cell => String(cell).toUpperCase().includes("MACEDO"))) {
        console.log(`Row ${i}:`, JSON.stringify(row));
      }
    });
  });

} catch (err) {
  console.error('Error reading file:', err);
}
