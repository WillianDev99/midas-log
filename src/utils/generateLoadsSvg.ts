function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function wrapTextLines(text: string, maxCharsPerLine: number = 55): string[] {
  const words = (text || '').split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : ['-'];
}

export interface SvgLoadItem {
  rota: string;
  entregas: string | number;
  uf: string;
  peso: string | number;
  veiculo: string;
  frete: string;
}

export function generateLoadsSvg(dateStr: string, loads: SvgLoadItem[]): string {
  const width = 1000;
  const padding = 35;
  const contentWidth = width - (padding * 2);

  const colWidths = {
    rota: 460,
    entregas: 85,
    uf: 70,
    peso: 135,
    veiculo: 110,
    frete: 70
  };

  const rowDetails = loads.map(load => {
    const rotaLines = wrapTextLines(load.rota, 52);
    const height = Math.max(50, 18 + (rotaLines.length * 16));
    return {
      load,
      rotaLines,
      height
    };
  });

  const totalRowsHeight = rowDetails.reduce((acc, r) => acc + r.height, 0);
  const headerHeight = 90;
  const tableHeaderHeight = 40;
  const footerHeight = 55;
  const height = padding + headerHeight + tableHeaderHeight + (totalRowsHeight || 60) + footerHeight + padding;

  let rowsSvg = '';
  let curY = padding + headerHeight + tableHeaderHeight;

  if (rowDetails.length === 0) {
    rowsSvg = `
      <rect x="${padding}" y="${curY}" width="${contentWidth}" height="60" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
      <text x="${width / 2}" y="${curY + 35}" fill="#64748b" font-size="13" font-style="italic" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">
        Nenhuma carga com status Agenciando no momento.
      </text>
    `;
  } else {
    rowDetails.forEach(({ load, rotaLines, height: rowH }) => {
      let curX = padding;

      // Fundo e borda da linha
      rowsSvg += `<rect x="${padding}" y="${curY}" width="${contentWidth}" height="${rowH}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />`;

      // 1. ROTA
      rowsSvg += `<text x="${curX + 12}" y="${curY + 18}" fill="#0f172a" font-size="11" font-weight="700" font-family="system-ui, -apple-system, sans-serif">`;
      rotaLines.forEach((line, lIdx) => {
        rowsSvg += `<tspan x="${curX + 12}" dy="${lIdx === 0 ? 0 : 16}">${escapeXml(line)}</tspan>`;
      });
      rowsSvg += `</text>`;
      curX += colWidths.rota;
      rowsSvg += `<line x1="${curX}" y1="${curY}" x2="${curX}" y2="${curY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 2. ENTREGAS
      const middleY = curY + (rowH / 2) + 4;
      rowsSvg += `<text x="${curX + colWidths.entregas / 2}" y="${middleY}" fill="#334155" font-size="12" font-weight="600" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXml(String(load.entregas || '-'))}</text>`;
      curX += colWidths.entregas;
      rowsSvg += `<line x1="${curX}" y1="${curY}" x2="${curX}" y2="${curY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 3. UF
      rowsSvg += `<text x="${curX + colWidths.uf / 2}" y="${middleY}" fill="#0f172a" font-size="12" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXml(String(load.uf || '-').toUpperCase())}</text>`;
      curX += colWidths.uf;
      rowsSvg += `<line x1="${curX}" y1="${curY}" x2="${curX}" y2="${curY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 4. PESO TOTAL
      const pesoFormatted = typeof load.peso === 'number'
        ? `${load.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
        : String(load.peso).includes('kg') ? String(load.peso) : `${load.peso} kg`;
      rowsSvg += `<text x="${curX + colWidths.peso - 12}" y="${middleY}" fill="#0f172a" font-size="12" font-weight="600" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">${escapeXml(pesoFormatted)}</text>`;
      curX += colWidths.peso;
      rowsSvg += `<line x1="${curX}" y1="${curY}" x2="${curX}" y2="${curY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 5. VEÍCULO
      rowsSvg += `<text x="${curX + colWidths.veiculo / 2}" y="${middleY}" fill="#0f172a" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXml(String(load.veiculo || 'CARRETA').toUpperCase())}</text>`;
      curX += colWidths.veiculo;
      rowsSvg += `<line x1="${curX}" y1="${curY}" x2="${curX}" y2="${curY + rowH}" stroke="#e2e8f0" stroke-width="1" />`;

      // 6. FRETE
      rowsSvg += `<text x="${curX + colWidths.frete / 2}" y="${middleY}" fill="#334155" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXml(String(load.frete || 'CIF/FOB').toUpperCase())}</text>`;

      curY += rowH;
    });
  }

  // Tabela Header
  const headerY = padding + headerHeight;
  let thX = padding;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- Fundo Branco -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />

      <!-- Topo Header -->
      <g transform="translate(${padding}, ${padding})">
        <!-- Logo / Marca Midas Log -->
        <text x="0" y="36" fill="#f59e0b" font-size="28" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="1">MIDAS LOG</text>
        <text x="0" y="50" fill="#0f172a" font-size="9" font-weight="800" font-family="system-ui, -apple-system, sans-serif" letter-spacing="4">LOGÍSTICA</text>

        <!-- Título Central -->
        <text x="${contentWidth / 2}" y="36" fill="#0f172a" font-size="24" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">Cargas Disponíveis</text>

        <!-- Info Direita -->
        <text x="${contentWidth}" y="26" fill="#0f172a" font-size="13" font-weight="800" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">Midas Logística</text>
        <text x="${contentWidth}" y="44" fill="#64748b" font-size="12" font-weight="500" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">${escapeXml(dateStr)}</text>

        <!-- Linha Dourada -->
        <rect x="0" y="62" width="${contentWidth}" height="3" fill="#f59e0b" rx="1.5" />
      </g>

      <!-- Cabeçalho da Tabela -->
      <g transform="translate(0, 0)">
        <rect x="${padding}" y="${headerY}" width="${contentWidth}" height="${tableHeaderHeight}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
        
        <text x="${thX + 12}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" font-family="system-ui, -apple-system, sans-serif">ROTA</text>
        ${thX += colWidths.rota, `<line x1="${thX}" y1="${headerY}" x2="${thX}" y2="${headerY + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`}
        
        <text x="${thX + colWidths.entregas / 2}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">ENTREGAS</text>
        ${thX += colWidths.entregas, `<line x1="${thX}" y1="${headerY}" x2="${thX}" y2="${headerY + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`}

        <text x="${thX + colWidths.uf / 2}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">UF</text>
        ${thX += colWidths.uf, `<line x1="${thX}" y1="${headerY}" x2="${thX}" y2="${headerY + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`}

        <text x="${thX + colWidths.peso - 12}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">PESO TOTAL</text>
        ${thX += colWidths.peso, `<line x1="${thX}" y1="${headerY}" x2="${thX}" y2="${headerY + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`}

        <text x="${thX + colWidths.veiculo / 2}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">VEÍCULO</text>
        ${thX += colWidths.veiculo, `<line x1="${thX}" y1="${headerY}" x2="${thX}" y2="${headerY + tableHeaderHeight}" stroke="#e2e8f0" stroke-width="1" />`}

        <text x="${thX + colWidths.frete / 2}" y="${headerY + 24}" fill="#475569" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">FRETE</text>
      </g>

      <!-- Linhas de Dados -->
      ${rowsSvg}

      <!-- Rodapé -->
      <text x="${width / 2}" y="${height - padding}" fill="#64748b" font-size="11" font-weight="500" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">
        © ${new Date().getFullYear()} Midas Logística - Eficiência em Movimento
      </text>
    </svg>
  `;
}
