import fs from 'fs';
import XLSX from 'xlsx';

// Load parsed PDF data
const pdfPages = JSON.parse(fs.readFileSync('scratch/parsed_pdf_data.json', 'utf8'));

// We assume the PDF is for state 'PI' and client size 'MICRO'
const pdfUF = 'PI';
const pdfClientSize = 'MICRO';

// Load Excel workbook
const workbook = XLSX.readFile('public/SUPER PRIME 2026.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get dimensions
const range = XLSX.utils.decode_range(sheet['!ref']);
console.log(`Excel loaded. Range: ${sheet['!ref']} (Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1})`);

// Terms mapping
const termsMap = {
  '0-14DM': 0,
  '28DM': 1,
  '42DM': 2,
  '56DM': 3,
  '70DM': 4,
  '84DM': 5,
  '98DM': 6,
  '112DM': 7
};

// Count how many prices we fill
let filledCount = 0;
let missingPriceCount = 0;
let missingProductCount = 0;

for (let r = 1; r <= range.e.r; r++) {
  const nameCellRef = XLSX.utils.encode_cell({ c: 2, r: r }); // Col C is Name
  const nameCell = sheet[nameCellRef];
  if (!nameCell || !nameCell.v) continue;
  
  const rawProductName = String(nameCell.v).trim();
  
  // Extract level, format, type and product name
  // Example: AZURE POLIDO HD 100x100 A cx 3,00m2 - N9
  // Level: N9 -> 9
  // Format: 100x100
  // Group: We assume SUPER PRIME (from template)
  const levelMatch = rawProductName.match(/-\s*N(\d+)/i);
  const level = levelMatch ? parseInt(levelMatch[1]) : null;
  
  const formatMatch = rawProductName.match(/\b\d+(?:[\.,]\d+)?\s*[xX]\s*\d+(?:[\.,]\d+)?\b/);
  const format = formatMatch ? formatMatch[0].replace(/\s+/g, '').toUpperCase() : null;
  
  if (!level || !format) {
    console.log(`Row ${r + 1}: Could not parse level or format for "${rawProductName}"`);
    continue;
  }
  
  // Clean product name: e.g. "AZURE POLIDO HD"
  // Let's strip the complement like "100x100 A cx 3,00m2 - N9"
  let cleanedName = rawProductName;
  cleanedName = cleanedName.replace(formatMatch[0], ''); // remove format
  cleanedName = cleanedName.replace(/-\s*N\d+/i, ''); // remove level
  cleanedName = cleanedName.replace(/\b[AC]\b/g, ''); // remove type A or C
  cleanedName = cleanedName.replace(/cx\s*[\d,.]+\s*m2/i, ''); // remove cx
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim(); // normalize spaces
  
  // Clean name without HD for partial matching
  const cleanedNameNoHD = cleanedName.replace(/\bHD\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  
  // Let's find the matching page in PDF
  // We look for page with group 'SUPER PRIME' and format equal to our format
  const matchingPdfPage = pdfPages.find(p => 
    p.group === 'SUPER PRIME' && 
    p.format === format && 
    p.clientSize === pdfClientSize
  );
  
  if (!matchingPdfPage) {
    // Try to find if format is written differently or look by group
    missingProductCount++;
    continue;
  }
  
  // Now, we want to update the price columns for this row
  // Columns from H (index 7) to CY (index 102)
  for (let c = 7; c <= range.e.c; c++) {
    const headerCellRef = XLSX.utils.encode_cell({ c: c, r: 0 });
    const headerCell = sheet[headerCellRef];
    if (!headerCell || !headerCell.v) continue;
    
    const headerName = String(headerCell.v).trim();
    // Parse header: Preço#PI/MICRO/28DM
    if (!headerName.startsWith('Preço#')) continue;
    
    const headerParts = headerName.replace('Preço#', '').split('/');
    if (headerParts.length < 3) continue;
    
    const colUF = headerParts[0].toUpperCase();
    const colClientSize = headerParts[1].toUpperCase();
    const colTerm = headerParts[2].toUpperCase();
    
    // Check if this column matches the PDF we are processing (PI and MICRO)
    if (colUF === pdfUF && colClientSize === pdfClientSize) {
      const termIndex = termsMap[colTerm];
      if (termIndex === undefined) continue;
      
      // Get price from PDF page priceGrid
      const pricesForLevel = matchingPdfPage.priceGrid[level];
      if (pricesForLevel && pricesForLevel[termIndex] !== undefined) {
        const price = pricesForLevel[termIndex];
        const targetCellRef = XLSX.utils.encode_cell({ c: c, r: r });
        
        // Update cell in SheetJS
        sheet[targetCellRef] = { t: 'n', v: price };
        filledCount++;
      } else {
        missingPriceCount++;
      }
    }
  }
}

console.log(`Update complete. Filled prices: ${filledCount}. Missing prices: ${missingPriceCount}. Missing products: ${missingProductCount}`);

// Save to scratch
XLSX.writeFile(workbook, 'scratch/updated_SUPER_PRIME_2026.xlsx');
console.log("Saved updated Excel to scratch/updated_SUPER_PRIME_2026.xlsx");
