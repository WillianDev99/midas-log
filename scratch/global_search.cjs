const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const publicDir = path.join('c:', 'DEV', 'MIDAS RENT A CAR', 'midas-log', 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.XLSM'));

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      data.forEach((row, i) => {
        if (row.some(cell => String(cell).toUpperCase().includes("MACEDO"))) {
          console.log(`File: ${file}, Sheet: ${sheetName}, Row ${i}:`, JSON.stringify(row));
        }
      });
    });
  } catch (err) {
    // console.error(`Error reading ${file}:`, err);
  }
});
