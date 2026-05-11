const XLSX = require('xlsx');
const path = require('path');

function inspectFile(filename) {
    const filePath = path.join(__dirname, 'public', filename);
    console.log(`\n--- Inspecting: ${filename} ---`);
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length > 0) {
            console.log('Headers:', data[0]);
            console.log('Sample Data (Row 1):', data[1]);
        } else {
            console.log('File is empty.');
        }
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
    }
}

const files = [
    'Cadastro Clientes Cerbras.xlsx',
    'Fretes por Cidade Cerbras.XLSM',
    'Clientes Especiais Cerbras.XLSM'
];

files.forEach(inspectFile);
