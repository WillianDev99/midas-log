const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'DEV', 'MIDAS RENT A CAR', 'midas-log', 'public', 'Fretes por Cidade Cerbras.XLSM');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = 'Planilha1';
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  data.forEach((row, i) => {
    if (row[1] === "PI") {
      console.log(JSON.stringify(row));
    }
  });

} catch (err) {
  console.error('Error reading file:', err);
}
