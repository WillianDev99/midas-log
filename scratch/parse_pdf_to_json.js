import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function parsePdf(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({
    data: data,
    useSystemFonts: true,
    disableFontFace: true
  });
  const pdf = await loadingTask.promise;
  console.log(`PDF Loaded: ${filePath} (${pdf.numPages} pages)`);
  
  const parsedPages = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5]
    }));
    
    const pageData = parsePageItems(items, pageNum);
    parsedPages.push(pageData);
  }
  
  return parsedPages;
}

function parsePageItems(items, pageNum) {
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
  
  let group = "";
  let format = "";
  let clientSize = "";
  
  for (const line of lines) {
    if (line.text.includes("TABELA DE PREÇOS")) {
      const parts = line.text.split('-').map(p => p.trim());
      if (parts.length >= 3) {
        group = parts[1].toUpperCase();
        format = parts[2].replace(/\s+/g, '').toUpperCase();
      }
      break;
    }
  }
  
  for (const line of lines) {
    if (line.text.includes("CLIENTE:")) {
      const match = line.text.match(/CLIENTE:\s*(\w+)/i);
      if (match) {
        clientSize = match[1].toUpperCase();
      }
      break;
    }
  }
  
  if (!clientSize) {
    for (const line of lines) {
      if (line.text.includes("MICRO")) clientSize = "MICRO";
      else if (line.text.includes("PEQUENO")) clientSize = "PEQUENO";
      else if (line.text.includes("MEDIO") || line.text.includes("MÉDIO")) clientSize = "MEDIO";
      else if (line.text.includes("GRANDE")) clientSize = "GRANDE";
      if (clientSize) break;
    }
  }
  
  const priceGrid = {};
  const niveisLines = [];
  
  lines.forEach(line => {
    // Crucial fix: Only look at lines in the upper price table (y >= 600)
    if (line.y >= 600) {
      const match = line.text.match(/Nivel\s*([1-9])/i);
      if (match) {
        const level = parseInt(match[1]);
        niveisLines.push({ level, line });
      }
    }
  });
  
  niveisLines.forEach(({ level, line }) => {
    const priceItems = line.items.filter(item => {
      const str = item.str.trim();
      return str && !str.toLowerCase().includes("nivel");
    });
    
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
    
    const pricesOnly = tokens.filter(t => t.includes("R$") || t.match(/^\d+[,.]\d+$/));
    
    const priceFloats = pricesOnly.map(p => {
      const cleaned = p.replace("R$", "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      return parseFloat(cleaned);
    });
    
    priceGrid[level] = priceFloats;
  });
  
  let prodNivelStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].text.includes("Produtos por Nível")) {
      prodNivelStartIndex = i;
      break;
    }
  }
  
  const productsByLevel = {};
  for (let l = 1; l <= 9; l++) {
    productsByLevel[l] = [];
  }
  
  if (prodNivelStartIndex !== -1) {
    let headersLine = null;
    let headersLineIndex = -1;
    for (let i = prodNivelStartIndex + 1; i < lines.length; i++) {
      if (lines[i].text.includes("Nivel 1") && lines[i].text.includes("Nivel 2")) {
        headersLine = lines[i];
        headersLineIndex = i;
        break;
      }
    }
    
    if (headersLine) {
      const levelX = {};
      headersLine.items.forEach(item => {
        const match = item.str.match(/Nivel\s*([1-9])/i);
        if (match) {
          levelX[parseInt(match[1])] = item.x;
        }
      });
      
      for (let i = headersLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.text.includes("Condições Gerais") || line.text.includes("Preços FOB")) {
          break;
        }
        
        line.items.forEach(item => {
          const str = item.str.trim();
          if (str && !str.includes("Nivel")) {
            let closestLevel = null;
            let minDiff = 20.0;
            
            for (const [level, x] of Object.entries(levelX)) {
              const diff = Math.abs(item.x - x);
              if (diff < minDiff) {
                minDiff = diff;
                closestLevel = parseInt(level);
              }
            }
            
            if (closestLevel !== null) {
              productsByLevel[closestLevel].push(str);
            }
          }
        });
      }
    }
  }
  
  return {
    pageNum,
    group,
    format,
    clientSize,
    priceGrid,
    productsByLevel
  };
}

async function run() {
  const result = await parsePdf('public/TAB PADRÃO UFS - MICRO.pdf');
  fs.writeFileSync('scratch/parsed_pdf_data.json', JSON.stringify(result, null, 2));
  console.log("Parsed PDF results saved to scratch/parsed_pdf_data.json");
  
  console.log("\nPAGE 1 SUMMARY (AFTER Y-COORDINATE FIX):");
  console.log("Group:", result[0].group);
  console.log("Format:", result[0].format);
  console.log("Client Size:", result[0].clientSize);
  console.log("Price Grid Nivel 1:", result[0].priceGrid[1]);
  console.log("Price Grid Nivel 2:", result[0].priceGrid[2]);
  console.log("Price Grid Nivel 3:", result[0].priceGrid[3]);
  console.log("Products by Level:", result[0].productsByLevel);
}

run();
