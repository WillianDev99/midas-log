const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'DEV', 'MIDAS RENT A CAR', 'midas-log', 'public', 'Clientes Especiais Cerbras.XLSM');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  data.forEach((row, i) => {
    if (row.some(cell => String(cell).toUpperCase().includes("PICOS"))) {
      console.log(`Row ${i}:`, JSON.stringify(row));
    }
  });

} catch (err) {
  console.error('Error reading file:', err);
}
