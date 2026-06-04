import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  try {
    console.log("Loading PDF...");
    const data = new Uint8Array(fs.readFileSync('public/TAB PADRÃO UFS - MICRO.pdf'));
    const loadingTask = pdfjsLib.getDocument({
      data: data,
      useSystemFonts: true,
      disableFontFace: true
    });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Number of pages: ${pdf.numPages}`);
    
    // Dump all text to a file for analysis
    let allText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const tc = await p.getTextContent();
      allText += `--- PAGE ${i} ---\n`;
      tc.items.forEach(item => {
        allText += `[${item.transform[4].toFixed(1)}, ${item.transform[5].toFixed(1)}] ${item.str}\n`;
      });
    }
    fs.writeFileSync('scratch/extracted_pdf_structure.txt', allText);
    console.log("Saved structure to scratch/extracted_pdf_structure.txt");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
