import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const data = new Uint8Array(fs.readFileSync('public/TAB PADRÃO UFS - MICRO.pdf'));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items.map(item => ({
    str: item.str,
    x: item.transform[4],
    y: item.transform[5]
  }));
  
  console.log("Items on Page 1 between y=720 and y=730:");
  const filtered = items.filter(it => it.y >= 720 && it.y <= 730);
  filtered.sort((a, b) => b.y - a.y || a.x - b.x);
  filtered.forEach(it => {
    console.log(`[${it.x.toFixed(1)}, ${it.y.toFixed(1)}] ${JSON.stringify(it.str)}`);
  });
}

run();
