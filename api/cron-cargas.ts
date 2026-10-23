import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';
// @ts-ignore
import { generateSvgCard } from './generatePngCard.cjs';

const TELEGRAM_BOT_TOKEN = "8211554528:AAFrR9uRKisGtHgXWAFdw9BCx6HyrcSSM5M";
const TELEGRAM_CHAT_ID = "1733888570";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=xlsx";

function normalizeText(text: string) {
  if (!text) return "";
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function excelSerialToDate(serialVal: any): string {
  if (!serialVal) return "";
  const serial = Number(serialVal);
  if (!isNaN(serial) && serial > 0) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(serialVal);
}

async function sendTelegramPhotoBuffer(photoBuffer: Buffer, caption: string) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${TELEGRAM_CHAT_ID}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="cargas.png"\r\nContent-Type: image/png\r\n\r\n`),
    photoBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("Falha ao baixar planilha");
    const arrayBuffer = await response.arrayBuffer();
    const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    // Encontrar aba CARGAS
    const sheetName = wb.SheetNames.find((name: string) => name.toUpperCase() === "CARGAS") || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return res.status(200).json({ message: "Planilha sem dados na aba CARGAS" });
    }

    // Identificar colunas dinamicamente
    const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toUpperCase());
    let colData = headers.findIndex((h: string) => h === 'DATA' || h.includes('DATA'));
    let colUF = headers.findIndex((h: string) => h === 'UF');
    let colPeso = headers.findIndex((h: string) => h === 'PESO');
    let colFrete = headers.findIndex((h: string) => h === 'FRETE');
    let colStatus = headers.findIndex((h: string) => h === 'STATUS');

    const entregaIndices: number[] = [];
    headers.forEach((h: string, i: number) => {
      if (h === 'ENTREGAS' || h === 'ROTA' || h === 'DESTINO') {
        entregaIndices.push(i);
      }
    });

    let colRota = entregaIndices.length > 0 ? entregaIndices[0] : 1;
    let colEntregas = entregaIndices.length > 1 ? entregaIndices[1] : 2;

    if (colData === -1) colData = 0;
    if (colUF === -1) colUF = 3;
    if (colPeso === -1) colPeso = 4;
    if (colFrete === -1) colFrete = 5;
    if (colStatus === -1) colStatus = 11;

    const agenciandoLoads: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rota = String(r[colRota] || '').trim();
      const status = colStatus !== -1 ? String(r[colStatus] || '').trim() : '';
      if (rota && normalizeText(status).includes('agenciando')) {
        const rawUF = String(r[colUF] || '').replace(/[^A-Z]/gi, '').substring(0, 2).toUpperCase();
        agenciandoLoads.push({
          data: excelSerialToDate(r[colData]),
          rota,
          entregas: r[colEntregas] || '-',
          uf: rawUF,
          peso: r[colPeso] || 0,
          frete: String(r[colFrete] || 'CIF/FOB')
        });
      }
    }

    const today = new Date().toLocaleDateString('pt-BR');

    // Grupos
    const maranhao = agenciandoLoads.filter(l => l.uf === 'MA');
    const cearaPiaui = agenciandoLoads.filter(l => ['CE', 'PI'].includes(l.uf));
    const outros = agenciandoLoads.filter(l => !['CE', 'PI', 'MA', 'AL'].includes(l.uf));

    // 1. Enviar Grupo Maranhão (se houver cargas)
    if (maranhao.length > 0) {
      const pngMA = generateSvgCard('Maranhão', today, maranhao);
      await sendTelegramPhotoBuffer(pngMA, `Cargas Hidracor ${today}, Maranhão`);
    }

    // 2. Enviar Grupo Ceará e Piauí (se houver cargas)
    if (cearaPiaui.length > 0) {
      const pngCE_PI = generateSvgCard('Ceará e Piauí', today, cearaPiaui);
      await sendTelegramPhotoBuffer(pngCE_PI, `Cargas Hidracor ${today}, Ceará e Piauí`);
    }

    // 3. Enviar Grupo Outros Estados (se houver cargas)
    if (outros.length > 0) {
      const pngOutros = generateSvgCard('Outros Estados', today, outros);
      await sendTelegramPhotoBuffer(pngOutros, `Cargas Hidracor ${today}, Outros Estados`);
    }

    return res.status(200).json({
      ok: true,
      totalAgenciando: agenciandoLoads.length,
      maranhao: maranhao.length,
      cearaPiaui: cearaPiaui.length,
      outros: outros.length
    });
  } catch (err: any) {
    console.error("Erro no Cron de Cargas:", err);
    return res.status(500).json({ error: err.message });
  }
}
