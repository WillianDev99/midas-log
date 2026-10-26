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

// Quebra de texto inteligente mantendo espaços preservados
function wrapText(text, maxChars) {
  // Normalizar múltiplos espaços mantendo exatamente 1 espaço
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const lines = [];
  let cur = '';

  for (const w of words) {
    if ((cur ? cur + ' ' + w : w).length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
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

  // Larguras idênticas à tabela do site:
  // ROTA: 48% (382), ENTREGAS: 9% (72), UF: 7% (56), PESO TOTAL: 14% (111), VEÍCULO: 12% (95), FRETE: 10% (80)
  const colRota = 382;
  const colEntregas = 72;
  const colUF = 56;
  const colPeso = 111;
  const colVeiculo = 95;
  const colFrete = contentWidth - colRota - colEntregas - colUF - colPeso - colVeiculo;

  // Carregar logo base64 se disponível
  let logoSvg = '';
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const b64 = fs.readFileSync(logoPath).toString('base64');
      logoSvg = `<image href="data:image/png;base64,${b64}" x="${padding}" y="${padding}" width="150" height="50" preserveAspectRatio="xMinYMid meet" />`;
    }
  } catch {}

  if (!logoSvg) {
    logoSvg = `<text x="${padding}" y="${padding + 36}" fill="#f59e0b" font-size="28" font-weight="800" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif">MIDAS LOG</text>`;
  }

  // Fonte padrão idêntica ao site: Segoe UI, Roboto, sans-serif
  const FONT_FAMILY = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  // Calcular linhas da tabela
  const rowDetails = loads.map(l => {
    const rotaLines = wrapText(l.rota, 46);
    const height = Math.max(54, 22 + (rotaLines.length * 17));
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
      <text x="${width / 2}" y="${currentY + tableHeaderHeight + 35}" fill="#64748b" font-size="13" font-style="italic" text-anchor="middle" font-family="${FONT_FAMILY}">Nenhuma carga com status Agenciando no momento.</text>
    `;
    currentY += 60;
  } else {
    let rowY = currentY + tableHeaderHeight;
    rowDetails.forEach(({ load, rotaLines, height: rowH }) => {
      let x = padding;
      const midY = rowY + (rowH / 2) + 4;

      // Fundo branco e borda da linha
      let cells = `<rect x="${padding}" y="${rowY}" width="${contentWidth}" height="${rowH}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />`;

      // 1. ROTA (Fonte nítida com espaçamento limpo entre palavras)
      const textStartY = rowY + 18;
      const textLinesSvg = rotaLines.map((line, lIdx) => 
        `<tspan x="${x + 12}" y="${textStartY + (lIdx * 17)}">${escapeXml(line)}</tspan>`
      ).join('');
      cells += `<text fill="#0f172a" font-size="11" font-weight="700" letter-spacing="0.1px" font-family="${FONT_FAMILY}">${textLinesSvg}</text>`;
      x += colRota;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 2. ENTREGAS
      cells += `<text x="${x + (colEntregas / 2)}" y="${midY}" fill="#334155" font-size="12" font-weight="600" text-anchor="middle" font-family="${FONT_FAMILY}">${escapeXml(load.entregas || '-')}</text>`;
      x += colEntregas;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 3. UF
      cells += `<text x="${x + (colUF / 2)}" y="${midY}" fill="#0f172a" font-size="12" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">${escapeXml(load.uf || '-')}</text>`;
      x += colUF;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 4. PESO TOTAL
      cells += `<text x="${x + colPeso - 12}" y="${midY}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="end" font-family="${FONT_FAMILY}">${escapeXml(formatWeight(load.peso))}</text>`;
      x += colPeso;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 5. VEÍCULO
      cells += `<text x="${x + (colVeiculo / 2)}" y="${midY}" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">${escapeXml(getVehicleType(load.peso))}</text>`;
      x += colVeiculo;
      cells += `<line x1="${x}" y1="${rowY}" x2="${x}" y2="${rowY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 6. FRETE
      cells += `<text x="${x + (colFrete / 2)}" y="${midY}" fill="#334155" font-size="11" font-weight="700" text-anchor="middle" font-family="${FONT_FAMILY}">${escapeXml(load.frete || 'CIF/FOB')}</text>`;

      tableRowsSvg += cells;
      rowY += rowH;
    });
    currentY = rowY - tableHeaderHeight;
  }

  // Divisórias verticais do cabeçalho
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
  <text x="${width / 2}" y="${padding + 34}" fill="#0f172a" font-size="24" font-weight="800" letter-spacing="-0.5px" text-anchor="middle" font-family="${FONT_FAMILY}">Cargas Disponíveis</text>
  <text x="${width - padding}" y="${padding + 26}" fill="#0f172a" font-size="13" font-weight="800" text-anchor="end" font-family="${FONT_FAMILY}">Midas Logística</text>
  <text x="${width - padding}" y="${padding + 44}" fill="#64748b" font-size="12" font-weight="500" text-anchor="end" font-family="${FONT_FAMILY}">${escapeXml(dateStr)}</text>

  <!-- Linha Dourada / Âmbar -->
  <rect x="${padding}" y="${padding + 62}" width="${contentWidth}" height="3" fill="#f59e0b" rx="1.5" />

  <!-- Cabeçalho da Tabela -->
  <rect x="${padding}" y="${padding + headerHeight}" width="${contentWidth}" height="${tableHeaderHeight}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
  <text x="${padding + 12}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" font-family="${FONT_FAMILY}">ROTA</text>
  <text x="${padding + colRota + (colEntregas / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">ENTREGAS</text>
  <text x="${padding + colRota + colEntregas + (colUF / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">UF</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso - 12}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="end" font-family="${FONT_FAMILY}">PESO TOTAL</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso + (colVeiculo / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">VEÍCULO</text>
  <text x="${padding + colRota + colEntregas + colUF + colPeso + colVeiculo + (colFrete / 2)}" y="${padding + headerHeight + 23}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="${FONT_FAMILY}">FRETE</text>
  ${headerLines}

  <!-- Linhas de Dados -->
  ${tableRowsSvg}

  <!-- Rodapé -->
  <text x="${width / 2}" y="${height - padding - 15}" fill="#64748b" font-size="11" font-weight="500" text-anchor="middle" font-family="${FONT_FAMILY}">© ${new Date().getFullYear()} Midas Logística - Eficiência em Movimento</text>
</svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'zoom',
      value: 2 // resolução 2x (retina ultra cristalina)
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'Segoe UI'
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
