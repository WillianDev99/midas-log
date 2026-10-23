// Serviço utilitário de integração com o Telegram Bot
const TELEGRAM_BOT_TOKEN = "8211554528:AAFrR9uRKisGtHgXWAFdw9BCx6HyrcSSM5M";
const TELEGRAM_CHAT_ID = "1733888570";

/**
 * Envia uma mensagem de texto formatada para o chat do Telegram
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    console.error("Erro ao enviar mensagem Telegram:", err);
    return false;
  }
}

/**
 * Envia uma imagem (Blob / Buffer) com legenda (caption) para o chat do Telegram
 */
export async function sendTelegramPhoto(blob: Blob, caption: string): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', blob, 'carga.png');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    console.error("Erro ao enviar foto Telegram:", err);
    return false;
  }
}
