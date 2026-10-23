const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function getVehicleType(peso) {
  const num = typeof peso === 'number' ? peso : parseFloat(String(peso || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const ton = num / 1000;
  if (ton < 18) return 'TRUCK';
  if (ton <= 22) return 'BITRUCK';
  if (ton <= 30) return 'CARRETA';
  if (ton <= 38) return 'BITREM';
  if (ton <= 40) return 'RODOTREM 3 TAMPAS';
  return 'RODOTREM 4 TAMPAS';
}

function formatWeight(peso) {
  const num = typeof peso === 'number' ? peso : parseFloat(String(peso || '0').replace(/\./g, '').replace(',', '.')) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

function generateSvgCard(title, dateStr, loads) {
  const width = 860;
  const padding = 32;
  const contentWidth = width - (padding * 2);

  // Larguras de coluna exatas:
  // ROTA: 48% (382), ENTREGAS: 9% (72), UF: 7% (56), PESO: 14% (111), VEÍCULO: 12% (95), FRETE: 10% (80)
  const colRota = 382;
  const colEntregas = 72;
  const colUF = 56;
  const colPeso = 111;
  const colVeiculo = 95;
  const colFrete = contentWidth - colRota - colEntregas - colUF - colPeso - colVeiculo;

  // Carregar logo base64 se disponível
  let logoSvg = '';
  try {
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      logoSvg = `<image href="data:image/png;base64,${b64}" x="${padding}" y="${padding}" width="150" height="50" preserveAspectRatio="xMinYMid meet" />`;
    }
  } catch {}

  if (!logoSvg) {
    logoSvg = `<text x="${padding}" y="${padding + 36}" fill="#f59e0b" font-size="28" font-weight="900" font-family="system-ui, sans-serif">MIDAS LOG</text>`;
  }

  // Calcular linhas da tabela
  const rowDetails = loads.map(l => {
    const rotaLines = wrapText(l.rota, 48);
    const height = Math.max(50, 20 + (rotaLines.length * 16));
    return {
      load: l,
      rotaLines,
      height
    };
  });

  const totalRowsHeight = rowDetails.reduce((acc, r) => acc + r.height, 0);
  const headerHeight = 90;
  const tableHeaderHeight = 38;
  const footerHeight = 55;
  const height = padding + headerHeight + tableHeaderHeight + (loads.length > 0 ? totalRowsHeight : 60) + footerHeight + padding;

  let currentY = padding + headerHeight;

  let tableRowsSvg = '';
  if (rowDetails.length === 0) {
    tableRowsSvg = `
      <rect x="${padding}" y="${currentY + tableHeaderHeight}" width="${contentWidth}" height="60" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
      <text x="${width / 2}" y="${currentY + tableHeaderHeight + 35}" fill="#64748b" font-size="13" font-style="italic" text-anchor="middle" font-family="system-ui, sans-serif">Nenhuma carga com status Agenciando no momento.</text>
    `;
    currentY += 60;
  } else {
    let rowY = currentY + tableHeaderHeight;
    rowDetails.forEach(({ load, rotaLines, height: rowH }) => {
      let x = padding;
      const midY = rowY + (rowH / 2) + 4;

      // Fundo e borda externa da linha
      let cells = `<rect x="${padding}" y="${rowY}" width="${contentWidth}" height="${rowH}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />`;

      // 1. Rota (linhas de texto)
      const textStartY = rowY + 18;
      const textLinesSvg = rotaLines.map((line, lIdx) => 
        `<tspan x="${x + 12}" y="${textStartY + (lIdx * 16)}">${escapeXml(line)}</tspan>`
      ).join('');
      cells += `<text fill="#0f172a" font-size="11" font-weight="700" font-family="system-ui, sans-serif">${textLinesSvg}</text>`;
      x += colRota;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 2. Entregas
      cells += `<text x="${x + (colEntregas / 2)}" y="${midY}" fill="#334155" font-size="12" font-weight="600" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(load.entregas || '-')}</text>`;
      x += colEntregas;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 3. UF
      cells += `<text x="${x + (colUF / 2)}" y="${midY}" fill="#0f172a" font-size="12" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(load.uf || '-')}</text>`;
      x += colUF;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 4. Peso
      cells += `<text x="${x + colPeso - 12}" y="${midY}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="end" font-family="system-ui, sans-serif">${escapeXml(formatWeight(load.peso))}</text>`;
      x += colPeso;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 5. Veículo
      cells += `<text x="${x + (colVeiculo / 2)}" y="${midY}" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(getVehicleType(load.peso))}</text>`;
      x += colVeiculo;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 6. Frete
      cells += `<text x="${x + (colFrete / 2)}" y="${midY}" fill="#334155" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${escapeXml(load.frete || 'CIF/FOB')}</text>`;

      tableRowsSvg += cells;
      rowY += rowH;
    });
    currentY = rowY - tableHeaderHeight;
  }

  // Divisórias do cabeçalho
  let hx = padding;
  let headerLines = '';
  [colRota, colEntregas, colUF, colPeso, colVeiculo].forEach(cw => {
    hx += cw;
    headerLines += `<line x1="${hx}" y1="${padding + headerHeight}" x2="${hx}" y2="${padding + headerHeight + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`;
  });

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Fundo Branco -->
  <rect width="100%" height="100%" fill="#ffffff" />

  <!-- Cabeçalho -->
  ${logoSvg}
  <text x="${width / 2}" y="${padding + 34}" fill="#0f172a" font-size="24" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">Cargas Disponíveis</text>
  <text x="${width - padding}" y="${padding + 26}" fill="#0f172a" font-size="13" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">Midas Logística</text>
  <text x="${width - padding}" y="${padding + 44}" fill="#64748b" font-size="12" font-weight="500" text-anchor="end" font-family="system-ui, sans-serif">${escapeXml(dateStr)}</text>

  <!-- Linha Dourada -->
  <rect x="${padding}" y="${padding + 62}" width="${contentWidth}" height="3" fill="#f59e0b" rx="1.5" />

  <!-- Cabeçalho da Tabela -->
  <rect x="${padding}" y="${padding + headerHeight}" width="${contentWidth}" height="${tableHeaderHeight}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
  <text x="${padding + 12}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" font-family="system-ui, sans-serif">ROTA</text>
  <text x="${padding + colRota + (colEntregas / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">ENTREGAS</text>
  <text x="${padding + colRota + colEntregas + (colUF / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">UF</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso - 12}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="end" font-family="system-ui, sans-serif">PESO TOTAL</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso + (colVeiculo / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">VEÍCULO</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso + colVeiculo + (colFrete / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, sans-serif">FRETE</text>
  ${headerLines}

  <!-- Linhas de Dados -->
  ${tableRowsSvg}

  <!-- Rodapé -->
  <text x="${width / 2}" y="${height - padding - 15}" fill="#64748b" font-size="11" font-weight="500" text-anchor="middle" font-family="system-ui, sans-serif">© ${new Date().getFullYear()} Midas Logística - Eficiência em Movimento</text>
</svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'zoom',
      value: 2 // resolução 2x ultra nítida
    }
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

module.exports = {
  generateSvgCard,
  getVehicleType,
  formatWeight
};
