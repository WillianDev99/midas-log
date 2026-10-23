// Gerador de imagem de Cargas idêntico ao modelo claro oficial da Midas Logística
export interface CardLoadItem {
  id?: string;
  data?: string;
  rota: string;
  entregas?: string | number;
  uf: string;
  peso: string | number;
  frete?: string;
  status?: string;
  veiculo?: string;
}

// Carregar logo em base64 se estiver no navegador
async function getLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    } catch {
      resolve(null);
    }
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function generateLoadsCardBlob(
  title: string, 
  dateStr: string, 
  loads: CardLoadItem[]
): Promise<Blob> {
  const logoImg = await getLogoImage();

  return new Promise((resolve, reject) => {
    try {
      const width = 860;
      const padding = 32;
      const contentWidth = width - (padding * 2);

      // Colunas exatamente como no modelo oficial:
      // ROTA (48% = 382px), ENTREGAS (9% = 71px), UF (7% = 56px), PESO TOTAL (14% = 111px), VEÍCULO (12% = 95px), FRETE (10% = 81px)
      const colWidths = {
        rota: Math.round(contentWidth * 0.48),
        entregas: Math.round(contentWidth * 0.09),
        uf: Math.round(contentWidth * 0.07),
        peso: Math.round(contentWidth * 0.14),
        veiculo: Math.round(contentWidth * 0.12),
        frete: contentWidth - Math.round(contentWidth * 0.48) - Math.round(contentWidth * 0.09) - Math.round(contentWidth * 0.07) - Math.round(contentWidth * 0.14) - Math.round(contentWidth * 0.12)
      };

      // Canvas preliminar para calcular altura dinâmica das linhas (texto longo da rota)
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error("Contexto 2D indisponível");

      tempCtx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const rowDetails = loads.map(load => {
        const rotaLines = wrapText(tempCtx, load.rota || '-', colWidths.rota - 24);
        const calcHeight = Math.max(50, 18 + (rotaLines.length * 16));
        return {
          load,
          rotaLines,
          height: calcHeight
        };
      });

      const totalRowsHeight = rowDetails.reduce((acc, r) => acc + r.height, 0);
      const headerHeight = 90;
      const tableHeaderHeight = 38;
      const footerHeight = 55;
      const height = padding + headerHeight + tableHeaderHeight + totalRowsHeight + footerHeight + padding;

      // Canvas real com resolução 2x (retina cristalina)
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Contexto 2D indisponível");

      ctx.scale(2, 2);

      // Fundo Branco puro do card
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // --- CABEÇALHO ---
      const headerY = padding;

      // 1. Logo
      if (logoImg) {
        ctx.drawImage(logoImg, padding, headerY, 150, 50);
      } else {
        // Fallback texto MIDAS LOG com estilo
        ctx.fillStyle = '#f59e0b';
        ctx.font = '900 28px system-ui, -apple-system, sans-serif';
        ctx.fillText('MIDAS LOG', padding, headerY + 36);
      }

      // 2. Título Central
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 24px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cargas Disponíveis', width / 2, headerY + 34);

      // 3. Info Direita
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('Midas Logística', width - padding, headerY + 26);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(dateStr, width - padding, headerY + 44);
      ctx.textAlign = 'left';

      // 4. Linha Dourada Divisória
      const lineY = headerY + 62;
      ctx.fillStyle = '#f59e0b'; // âmbar / dourado Midas
      ctx.fillRect(padding, lineY, contentWidth, 3);

      // --- TABELA ---
      const tableX = padding;
      let currentY = lineY + 16;

      // Cabeçalho da Tabela (Fundo cinza claro #f8fafc)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, currentY, contentWidth, tableHeaderHeight);

      // Bordas do cabeçalho
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(tableX, currentY, contentWidth, tableHeaderHeight);

      // Textos das Colunas do Cabeçalho
      ctx.fillStyle = '#475569';
      ctx.font = '800 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      let colX = tableX;

      // Coluna ROTA
      ctx.textAlign = 'left';
      ctx.fillText('ROTA', colX + 12, currentY + 23);
      colX += colWidths.rota;
      ctx.strokeRect(colX, currentY, 0, tableHeaderHeight);

      // Coluna ENTREGAS
      ctx.textAlign = 'center';
      ctx.fillText('ENTREGAS', colX + (colWidths.entregas / 2), currentY + 23);
      colX += colWidths.entregas;
      ctx.strokeRect(colX, currentY, 0, tableHeaderHeight);

      // Coluna UF
      ctx.fillText('UF', colX + (colWidths.uf / 2), currentY + 23);
      colX += colWidths.uf;
      ctx.strokeRect(colX, currentY, 0, tableHeaderHeight);

      // Coluna PESO TOTAL
      ctx.textAlign = 'right';
      ctx.fillText('PESO TOTAL', colX + colWidths.peso - 12, currentY + 23);
      colX += colWidths.peso;
      ctx.strokeRect(colX, currentY, 0, tableHeaderHeight);

      // Coluna VEÍCULO
      ctx.textAlign = 'center';
      ctx.fillText('VEÍCULO', colX + (colWidths.veiculo / 2), currentY + 23);
      colX += colWidths.veiculo;
      ctx.strokeRect(colX, currentY, 0, tableHeaderHeight);

      // Coluna FRETE
      ctx.fillText('FRETE', colX + (colWidths.frete / 2), currentY + 23);

      currentY += tableHeaderHeight;

      // Linhas da Tabela
      if (rowDetails.length === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tableX, currentY, contentWidth, 60);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(tableX, currentY, contentWidth, 60);
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nenhuma carga com status Agenciando no momento.', width / 2, currentY + 35);
        currentY += 60;
      } else {
        rowDetails.forEach(({ load, rotaLines, height: rowH }) => {
          // Fundo branco
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tableX, currentY, contentWidth, rowH);

          // Borda da linha
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.strokeRect(tableX, currentY, contentWidth, rowH);

          let curColX = tableX;

          // 1. ROTA (Texto completo sem corte, com quebra de linha)
          ctx.textAlign = 'left';
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const textStartY = currentY + 18;
          rotaLines.forEach((line, lIdx) => {
            ctx.fillText(line, curColX + 12, textStartY + (lIdx * 16));
          });
          curColX += colWidths.rota;
          ctx.strokeRect(curColX, currentY, 0, rowH);

          // 2. ENTREGAS
          ctx.textAlign = 'center';
          ctx.fillStyle = '#334155';
          ctx.font = '600 12px system-ui, -apple-system, sans-serif';
          const middleY = currentY + (rowH / 2) + 4;
          ctx.fillText(String(load.entregas || '-'), curColX + (colWidths.entregas / 2), middleY);
          curColX += colWidths.entregas;
          ctx.strokeRect(curColX, currentY, 0, rowH);

          // 3. UF
          ctx.fillStyle = '#0f172a';
          ctx.font = '800 12px system-ui, -apple-system, sans-serif';
          ctx.fillText(String(load.uf || '-').toUpperCase(), curColX + (colWidths.uf / 2), middleY);
          curColX += colWidths.uf;
          ctx.strokeRect(curColX, currentY, 0, rowH);

          // 4. PESO TOTAL
          ctx.textAlign = 'right';
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 12px system-ui, -apple-system, sans-serif';
          const pesoFormatted = typeof load.peso === 'number'
            ? `${load.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
            : String(load.peso).includes('kg') ? String(load.peso) : `${load.peso} kg`;
          ctx.fillText(pesoFormatted, curColX + colWidths.peso - 12, middleY);
          curColX += colWidths.peso;
          ctx.strokeRect(curColX, currentY, 0, rowH);

          // 5. VEÍCULO
          ctx.textAlign = 'center';
          ctx.fillStyle = '#0f172a';
          ctx.font = '800 11px system-ui, -apple-system, sans-serif';
          ctx.fillText(String(load.veiculo || 'CARRETA').toUpperCase(), curColX + (colWidths.veiculo / 2), middleY);
          curColX += colWidths.veiculo;
          ctx.strokeRect(curColX, currentY, 0, rowH);

          // 6. FRETE
          ctx.fillStyle = '#334155';
          ctx.font = '700 11px system-ui, -apple-system, sans-serif';
          ctx.fillText(String(load.frete || 'CIF/FOB').toUpperCase(), curColX + (colWidths.frete / 2), middleY);

          currentY += rowH;
        });
      }

      // --- RODAPÉ ---
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`© ${new Date().getFullYear()} Midas Logística - Eficiência em Movimento`, width / 2, currentY + 34);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar Blob"));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
