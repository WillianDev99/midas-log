import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';
import { generateLoadsSvg, SvgLoadItem } from '../src/utils/generateLoadsSvg';

const TELEGRAM_BOT_TOKEN = "8211554528:AAFrR9uRKisGtHgXWAFdw9BCx6HyrcSSM5M";
const TELEGRAM_CHAT_ID = "1733888570";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1_84-QjABx4I97rSUPIA1bNkZkZ3hVkdjM4fzc5o_Who/export?format=xlsx";

function normalizeText(text: string) {
  if (!text) return "";
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseWeightNumber(weight: string | number): number {
  if (typeof weight === 'number') return weight;
  const str = String(weight || '0').trim();
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

function getVehicleType(weight: string | number): string {
  const num = parseWeightNumber(weight);
  const ton = num / 1000;
  if (ton < 18) return 'TRUCK';
  if (ton <= 22) return 'BITRUCK';
  if (ton <= 30) return 'CARRETA';
  if (ton <= 38) return 'BITREM';
  if (ton <= 40) return 'RODOTREM 3 TAMPAS';
  return 'RODOTREM 4 TAMPAS';
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

async function sendTelegramSvgDocument(svgContent: string, filename: string, caption: string) {
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHAT_ID);
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  formData.append('document', blob, filename);
  formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error("Falha ao baixar planilha");
    const arrayBuffer = await response.arrayBuffer();
    const wb = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    // Encontrar aba correta ("CARGAS")
    const sheetName = wb.SheetNames.find(name => name.toUpperCase() === "CARGAS") || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return res.status(200).json({ message: "Planilha sem dados" });
    }

    // Mapear cabeçalhos dinamicamente
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

    let colRota = -1;
    let colEntregas = -1;
    if (entregaIndices.length >= 2) {
      colRota = entregaIndices[0];
      colEntregas = entregaIndices[1];
    } else if (entregaIndices.length === 1) {
      colRota = entregaIndices[0];
    }

    if (colData === -1) colData = 0;
    if (colRota === -1) colRota = 1;
    if (colEntregas === -1) colEntregas = 2;
    if (colUF === -1) colUF = 3;
    if (colPeso === -1) colPeso = 4;
    if (colFrete === -1) colFrete = 5;
    if (colStatus === -1) colStatus = 11;

    const agenciandoLoads: (SvgLoadItem & { data: string })[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rota = String(r[colRota] || '').trim();
      const status = String(r[colStatus] || '').trim();
      if (rota && normalizeText(status).includes('agenciando')) {
        const rawUF = String(r[colUF] || '').replace(/[^A-Z]/gi, '').substring(0, 2).toUpperCase();
        const peso = r[colPeso] || 0;
        agenciandoLoads.push({
          data: excelSerialToDate(r[colData]),
          rota,
          entregas: r[colEntregas] || 1,
          uf: rawUF,
          peso: peso,
          veiculo: getVehicleType(peso),
          frete: String(r[colFrete] || 'CIF/FOB').toUpperCase()
        });
      }
    }

    const today = new Date().toLocaleDateString('pt-BR');

    // Separar nos 3 grupos solicitados
    const maranhao = agenciandoLoads.filter(l => l.uf === 'MA');
    const cearaPiaui = agenciandoLoads.filter(l => ['CE', 'PI'].includes(l.uf));
    const outros = agenciandoLoads.filter(l => !['CE', 'PI', 'MA', 'AL'].includes(l.uf));

    // Cabeçalho da Notificação Geral
    await sendTelegramText(`🔔 <b>RESUMO PROGRAMADO DE CARGAS HIDRACOR (${today})</b>\nStatus: <b>Agenciando (${agenciandoLoads.length} disponíveis)</b>`);

    // 1. Grupo Maranhão
    const captionMA = `Cargas Hidracor ${today}, Maranhão`;
    if (maranhao.length > 0) {
      const svgMA = generateLoadsSvg(today, maranhao);
      await sendTelegramSvgDocument(svgMA, `cargas-maranhao-${today.replace(/\//g, '-')}.svg`, captionMA);
    } else {
      await sendTelegramText(`📦 <b>${captionMA}</b>\n<i>Nenhuma carga agenciando no momento.</i>`);
    }

    // 2. Grupo Ceará e Piauí
    const captionCE_PI = `Cargas Hidracor ${today}, Ceará e Piauí`;
    if (cearaPiaui.length > 0) {
      const svgCE_PI = generateLoadsSvg(today, cearaPiaui);
      await sendTelegramSvgDocument(svgCE_PI, `cargas-ceara-piaui-${today.replace(/\//g, '-')}.svg`, captionCE_PI);
    } else {
      await sendTelegramText(`📦 <b>${captionCE_PI}</b>\n<i>Nenhuma carga agenciando no momento.</i>`);
    }

    // 3. Grupo Outros Estados
    const captionOutros = `Cargas Hidracor ${today}, Outros Estados`;
    if (outros.length > 0) {
      const svgOutros = generateLoadsSvg(today, outros);
      await sendTelegramSvgDocument(svgOutros, `cargas-outros-estados-${today.replace(/\//g, '-')}.svg`, captionOutros);
    } else {
      await sendTelegramText(`📦 <b>${captionOutros}</b>\n<i>Nenhuma carga agenciando no momento.</i>`);
    }

    return res.status(200).json({ 
      ok: true, 
      total: agenciandoLoads.length,
      maranhao: maranhao.length,
      cearaPiaui: cearaPiaui.length,
      outros: outros.length
    });
  } catch (err: any) {
    console.error("Erro no Cron de Cargas:", err);
    return res.status(500).json({ error: err.message });
  }
}
