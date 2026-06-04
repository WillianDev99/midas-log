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
  
  const linesMap = new Map();
  items.forEach(item => {
    let foundKey = null;
    for (const key of linesMap.keys()) {
      if (Math.abs(key - item.y) < 3.0) {
        foundKey = key;
        break;
      }
    }
    if (foundKey !== null) {
      linesMap.get(foundKey).push(item);
    } else {
      linesMap.set(item.y, [item]);
    }
  });
  
  const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
  const lines = sortedY.map(y => {
    const lineItems = linesMap.get(y);
    lineItems.sort((a, b) => a.x - b.x);
    return {
      y: y,
      items: lineItems,
      text: lineItems.map(it => it.str).join(' ')
    };
  });
  
  const niveisLines = [];
  lines.forEach(line => {
    const match = line.text.match(/Nivel\s*([1-9])/i);
    if (match) {
      niveisLines.push({ level: parseInt(match[1]), line });
    }
  });
  
  console.log("Niveis lines found:");
  niveisLines.forEach(({ level, line }) => {
    console.log(`Level ${level}: y=${line.y.toFixed(1)}, text=${JSON.stringify(line.text)}`);
    
    const priceItems = line.items.filter(item => {
      const str = item.str.trim();
      return str && !str.toLowerCase().includes("nivel");
    });
    console.log(`  Filtered price items:`, priceItems.map(pi => `(${pi.x.toFixed(1)}, ${JSON.stringify(pi.str)})`));
    
    // Tokens logic
    const tokens = [];
    for (let i = 0; i < priceItems.length; i++) {
      const str = priceItems[i].str.trim();
      if (str === "R$") {
        if (i + 1 < priceItems.length) {
          tokens.push("R$ " + priceItems[i+1].str.trim());
          i++;
        } else {
          tokens.push("R$");
        }
      } else if (str.startsWith("R$")) {
        tokens.push(str);
      } else if (str.match(/^\d+[,.]\d+$/)) {
        tokens.push("R$ " + str);
      } else {
        tokens.push(str);
      }
    }
    console.log(`  Tokens:`, tokens);
    const pricesOnly = tokens.filter(t => t.includes("R$") || t.match(/^\d+[,.]\d+$/));
    console.log(`  PricesOnly:`, pricesOnly);
  });
}

run();
