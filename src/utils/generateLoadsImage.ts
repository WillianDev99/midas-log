// Gerador de imagem de Cargas em SVG/Canvas para compartilhamento e envio ao Telegram
import { BRAZIL_STATES } from '@/components/ExportLoadsImageModal';

export interface CardLoadItem {
  id?: string;
  data: string;
  rota: string;
  entregas?: string;
  uf: string;
  peso: string | number;
  frete: string;
  status: string;
  veiculo?: string;
}

export function generateLoadsCardBlob(title: string, dateStr: string, loads: CardLoadItem[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const width = 1000;
      const headerHeight = 160;
      const rowHeight = 70;
      const footerHeight = 80;
      const tableHeaderHeight = 50;
      const rowsCount = Math.max(loads.length, 1);
      const height = headerHeight + tableHeaderHeight + (rowsCount * rowHeight) + footerHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // retina 2x
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Não foi possível criar contexto 2D do Canvas");
      }

      ctx.scale(2, 2);

      // Fundo geral
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Card Container com borda sutil
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.beginPath();
      ctx.roundRect(20, 20, width - 40, height - 40, 16);
      ctx.fill();

      // Topo do Header (Degradê de destaque)
      const grad = ctx.createLinearGradient(20, 20, width - 20, 20);
      grad.addColorStop(0, '#059669'); // emerald-600
      grad.addColorStop(1, '#10b981'); // emerald-500
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(20, 20, width - 40, 12, [16, 16, 0, 0]);
      ctx.fill();

      // Título
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.fillText(`CARGAS DISPONÍVEIS - ${title.toUpperCase()}`, 50, 75);

      // Subtítulo
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Midas Log • Cargas Hidracor • ${dateStr}`, 50, 105);

      // Badge de Quantidade
      ctx.fillStyle = '#065f46'; // emerald-900
      ctx.beginPath();
      ctx.roundRect(width - 240, 50, 190, 42, 8);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#a7f3d0'; // emerald-200
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${loads.length} CARGA(S) DISPONÍVEL(IS)`, width - 145, 77);
      ctx.textAlign = 'left';

      // Cabeçalho da Tabela
      const tableY = headerHeight;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, tableY, width - 80, tableHeaderHeight);

      ctx.fillStyle = '#cbd5e1'; // slate-300
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('DATA', 60, tableY + 30);
      ctx.fillText('ROTA / DESTINO', 160, tableY + 30);
      ctx.fillText('UF', 540, tableY + 30);
      ctx.fillText('PESO', 610, tableY + 30);
      ctx.fillText('VEÍCULO', 740, tableY + 30);
      ctx.fillText('STATUS', 870, tableY + 30);

      // Linhas de Cargas
      let curY = tableY + tableHeaderHeight;
      if (loads.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 16px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nenhuma carga com status Agenciando no momento.', width / 2, curY + 45);
        ctx.textAlign = 'left';
      } else {
        loads.forEach((l, idx) => {
          // Zebrado
          ctx.fillStyle = idx % 2 === 0 ? '#1e293b' : '#182234';
          ctx.fillRect(40, curY, width - 80, rowHeight);

          // Divisória inferior
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(40, curY + rowHeight);
          ctx.lineTo(width - 40, curY + rowHeight);
          ctx.stroke();

          // Data
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px system-ui, -apple-system, sans-serif';
          ctx.fillText(l.data || '-', 60, curY + 40);

          // Rota (Texto em destaque)
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          const maxRotaWidth = 350;
          let rotaText = l.rota || '-';
          if (ctx.measureText(rotaText).width > maxRotaWidth) {
            while (ctx.measureText(rotaText + '...').width > maxRotaWidth && rotaText.length > 5) {
              rotaText = rotaText.substring(0, rotaText.length - 1);
            }
            rotaText += '...';
          }
          ctx.fillText(rotaText, 160, curY + 40);

          // UF Badge
          ctx.fillStyle = '#0284c7'; // sky-600
          ctx.beginPath();
          ctx.roundRect(535, curY + 22, 40, 26, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(l.uf || '-', 555, curY + 40);
          ctx.textAlign = 'left';

          // Peso
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          const pesoFormatted = typeof l.peso === 'number' 
            ? `${l.peso.toLocaleString('pt-BR')} kg` 
            : `${l.peso} kg`;
          ctx.fillText(pesoFormatted, 610, curY + 40);

          // Veículo
          ctx.fillStyle = '#fbbf24'; // amber-400
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
          ctx.fillText(l.veiculo || 'CARRETA', 740, curY + 40);

          // Status Badge
          ctx.fillStyle = '#065f46';
          ctx.beginPath();
          ctx.roundRect(860, curY + 22, 90, 26, 6);
          ctx.fill();
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AGENCIANDO', 905, curY + 39);
          ctx.textAlign = 'left';

          curY += rowHeight;
        });
      }

      // Rodapé
      ctx.fillStyle = '#64748b';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillText('📞 Interessados entrar em contato com a equipe de logística Midas Log.', 50, height - 40);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao converter canvas para Blob"));
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}
