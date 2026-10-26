import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';

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

function getVehicleType(peso: any) {
  const num = typeof peso === 'number' ? peso : parseFloat(String(peso || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const ton = num / 1000;
  if (ton < 18) return 'TRUCK';
  if (ton <= 22) return 'BITRUCK';
  if (ton <= 30) return 'CARRETA';
  if (ton <= 38) return 'BITREM';
  if (ton <= 40) return 'RODOTREM 3 TAMPAS';
  return 'RODOTREM 4 TAMPAS';
}

function formatWeight(peso: any) {
  const num = typeof peso === 'number' ? peso : parseFloat(String(peso || '0').replace(/\./g, '').replace(',', '.')) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

async function sendTelegramText(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML'
    })
  });
  return res.json();
}

async function sendTelegramPhotoUrl(photoUrl: string, caption: string) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML'
    })
  });
  return res.json();
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

    // Formatar bloco de texto do Maranhão
    let msgMA = `📦 <b>Cargas Hidracor ${today}, Maranhão</b>\n`;
    if (maranhao.length === 0) {
      msgMA += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      maranhao.forEach((c, idx) => {
        msgMA += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${formatWeight(c.peso)} - 🚛 ${getVehicleType(c.peso)}`;
      });
    }

    // Formatar bloco de texto de Ceará e Piauí
    let msgCE_PI = `📦 <b>Cargas Hidracor ${today}, Ceará e Piauí</b>\n`;
    if (cearaPiaui.length === 0) {
      msgCE_PI += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      cearaPiaui.forEach((c, idx) => {
        msgCE_PI += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${formatWeight(c.peso)} - 🚛 ${getVehicleType(c.peso)}`;
      });
    }

    // Formatar bloco de texto de Outros Estados
    let msgOutros = `📦 <b>Cargas Hidracor ${today}, Outros Estados</b>\n`;
    if (outros.length === 0) {
      msgOutros += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      outros.forEach((c, idx) => {
        msgOutros += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${formatWeight(c.peso)} - 🚛 ${getVehicleType(c.peso)}`;
      });
    }

    // Enviar as mensagens completas
    await sendTelegramText(`🔔 <b>RESUMO PROGRAMADO DE CARGAS DISPONÍVEIS (${today})</b>\nTotal: <b>${agenciandoLoads.length} carga(s) agenciando</b>\n`);
    await sendTelegramText(msgMA);
    await sendTelegramText(msgCE_PI);
    await sendTelegramText(msgOutros);

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
