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

async function sendTelegramText(text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML'
    })
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("Falha ao baixar planilha");
    const arrayBuffer = await response.arrayBuffer();
    const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return res.status(200).json({ message: "Planilha sem dados" });
    }

    const header = rows[0].map(h => normalizeText(String(h || '')));
    const colRota = header.findIndex(h => h.includes('rota') || h.includes('destino'));
    const colUF = header.findIndex(h => h === 'uf' || h.includes('estado'));
    const colPeso = header.findIndex(h => h.includes('peso'));
    const colData = header.findIndex(h => h.includes('data'));
    const colStatus = header.findIndex(h => h.includes('status'));

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
          uf: rawUF,
          peso: String(r[colPeso] || '0')
        });
      }
    }

    const today = new Date().toLocaleDateString('pt-BR');

    // Grupos
    const maranhao = agenciandoLoads.filter(l => l.uf === 'MA');
    const cearaPiaui = agenciandoLoads.filter(l => ['CE', 'PI'].includes(l.uf));
    const outros = agenciandoLoads.filter(l => !['CE', 'PI', 'MA', 'AL'].includes(l.uf));

    // Montar texto padrão do Maranhão
    let msgMA = `📦 <b>Cargas Hidracor ${today}, Maranhão</b>\n`;
    if (maranhao.length === 0) {
      msgMA += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      maranhao.forEach((c, idx) => {
        msgMA += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${c.peso} kg - 📅 ${c.data}`;
      });
    }

    // Montar texto padrão Ceará e Piauí
    let msgCE_PI = `📦 <b>Cargas Hidracor ${today}, Ceará e Piauí</b>\n`;
    if (cearaPiaui.length === 0) {
      msgCE_PI += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      cearaPiaui.forEach((c, idx) => {
        msgCE_PI += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${c.peso} kg - 📅 ${c.data}`;
      });
    }

    // Montar texto padrão Outros Estados
    let msgOutros = `📦 <b>Cargas Hidracor ${today}, Outros Estados</b>\n`;
    if (outros.length === 0) {
      msgOutros += `<i>Nenhuma carga agenciando no momento.</i>\n`;
    } else {
      outros.forEach((c, idx) => {
        msgOutros += `\n${idx + 1}. 📍 <b>${c.rota}</b> (${c.uf}) - ⚖️ ${c.peso} kg - 📅 ${c.data}`;
      });
    }

    // Enviar as 3 mensagens no Telegram
    await sendTelegramText(`🔔 <b>RESUMO PROGRAMADO DE CARGAS HIDRACOR (${today})</b>\nStatus: <i>Disponíveis para Agenciamento</i>\n`);
    await sendTelegramText(msgMA);
    await sendTelegramText(msgCE_PI);
    await sendTelegramText(msgOutros);

    return res.status(200).json({ ok: true, count: agenciandoLoads.length });
  } catch (err: any) {
    console.error("Erro no Cron de Cargas:", err);
    return res.status(500).json({ error: err.message });
  }
}
