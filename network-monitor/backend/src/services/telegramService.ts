import fs from 'fs';
import path from 'path';

const TELEGRAM_API = 'https://api.telegram.org';

class TelegramService {
  private botToken: string = '';
  private chatId: string = '';
  private botName: string = '';
  private isConfigured = false;
  private pollingActive = false;
  private lastUpdateId = 0;
  private pollingTimer: NodeJS.Timeout | null = null;

  /**
   * Configura o token do bot e o chat ID destino
   */
  public configure(token: string, chatId: string) {
    this.botToken = token;
    this.chatId = chatId;
    this.isConfigured = !!(token && chatId);
    console.log(`[TELEGRAM] Configurado: token=${token ? '***' + token.slice(-6) : 'VAZIO'}, chatId=${chatId || 'VAZIO'}`);
  }

  public setChatId(chatId: string) {
    this.chatId = chatId;
    this.isConfigured = !!(this.botToken && chatId);
    console.log(`[TELEGRAM] Chat ID atualizado: ${chatId}`);
  }

  public getStatus() {
    return {
      configured: this.isConfigured,
      botName: this.botName,
      chatId: this.chatId,
      polling: this.pollingActive
    };
  }

  /**
   * Testa a conexão com o bot chamando getMe
   */
  public async testConnection(): Promise<{ ok: boolean; botName?: string; error?: string }> {
    if (!this.botToken) return { ok: false, error: 'Token do bot não configurado' };

    try {
      const resp = await fetch(`${TELEGRAM_API}/bot${this.botToken}/getMe`);
      const data = await resp.json() as any;
      
      if (data.ok) {
        this.botName = data.result.first_name || data.result.username;
        console.log(`[TELEGRAM] Bot conectado: ${this.botName} (@${data.result.username})`);
        return { ok: true, botName: this.botName };
      }
      return { ok: false, error: data.description || 'Erro desconhecido' };
    } catch (err: any) {
      console.error('[TELEGRAM] Erro no teste de conexão:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Inicia polling de updates do Telegram para receber comandos
   */
  public async startPolling() {
    if (this.pollingActive) return;
    if (!this.botToken) {
      console.warn('[TELEGRAM] Token não configurado, polling não iniciado.');
      return;
    }

    // Testar conexão primeiro
    const test = await this.testConnection();
    if (!test.ok) {
      console.error('[TELEGRAM] Falha na conexão, polling não iniciado:', test.error);
      return;
    }

    this.pollingActive = true;
    console.log(`[TELEGRAM] Polling iniciado para bot ${this.botName}...`);
    this.pollUpdates();
  }

  public stopPolling() {
    this.pollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('[TELEGRAM] Polling parado.');
  }

  private async pollUpdates() {
    if (!this.pollingActive) return;

    try {
      const resp = await fetch(
        `${TELEGRAM_API}/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`,
        { signal: AbortSignal.timeout(15000) }
      );
      const data = await resp.json() as any;

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          this.lastUpdateId = update.update_id;
          await this.handleUpdate(update);
        }
      }
    } catch (err: any) {
      if (err.name !== 'TimeoutError' && err.name !== 'AbortError') {
        console.error('[TELEGRAM] Erro no polling:', err.message);
      }
    }

    // Agendar próximo poll
    this.pollingTimer = setTimeout(() => this.pollUpdates(), 1000);
  }

  private async handleUpdate(update: any) {
    const message = update.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const chatId = String(message.chat.id);
    const chatTitle = message.chat.title || 'Privado';
    const senderName = message.from?.first_name || 'Desconhecido';

    console.log(`[TELEGRAM] Mensagem de ${senderName} no chat "${chatTitle}" (${chatId}): ${text}`);

    // Comando: /id — retorna o ID do chat
    if (text.toLowerCase() === '/id' || text.toLowerCase() === 'id') {
      await this.sendMessage(
        `🆔 O ID deste chat é: \`${chatId}\``,
        chatId
      );
      return;
    }

    // Comando: /setgroup — configura este chat como destino de alertas
    if (text.toLowerCase() === '/setgroup' || text.toLowerCase().startsWith('/setgroup ')) {
      const targetChatId = text.split(' ')[1] || chatId;
      this.setChatId(targetChatId);

      // Salvar no banco
      try {
        const { prisma } = await import('../db.js');
        await prisma.$executeRawUnsafe(`
          INSERT INTO Config ("key", value) VALUES ('telegram_chat_id', ?)
          ON CONFLICT("key") DO UPDATE SET value = excluded.value
        `, targetChatId);
        console.log(`[TELEGRAM] Chat ID de alertas salvo: ${targetChatId}`);
      } catch (err) {
        console.error('[TELEGRAM] Erro ao salvar chat ID:', err);
      }

      await this.sendMessage(
        `✅ Chat de alertas configurado para: \`${targetChatId}\``,
        chatId
      );
      return;
    }

    // Comando: /status — verifica status do sistema
    if (text.toLowerCase() === '/status') {
      try {
        const { monitoringService } = await import('./monitoringService.js');
        const inventory = monitoringService.getInventory();
        const online = inventory.filter(n => n.online).length;
        const offline = inventory.filter(n => !n.online).length;

        await this.sendMessage(
          `📊 *STATUS DO SISTEMA*\n\n` +
          `🟢 Online: ${online}\n` +
          `🔴 Offline: ${offline}\n` +
          `📡 Total: ${inventory.length}\n` +
          `⏱ Horário: ${new Date().toLocaleTimeString('pt-BR')}`,
          chatId
        );
      } catch (err) {
        await this.sendMessage('❌ Erro ao consultar status.', chatId);
      }
      return;
    }

    // Comando: /recon — reconhecer queda (mesmo que o WhatsApp)
    if (text.toLowerCase().startsWith('/recon ') || text.toLowerCase().startsWith('recon ')) {
      const fullText = text.replace(/^\/?(recon)\s+/i, '').trim();
      let identifier = '';
      let reason = '';

      if (fullText.includes(':')) {
        const parts = fullText.split(':');
        identifier = parts[0].trim();
        reason = parts.slice(1).join(':').trim();
      } else {
        const parts = fullText.split(/\s+/);
        identifier = parts[0];
        reason = parts.slice(1).join(' ').trim();
      }

      if (!identifier || !reason) {
        await this.sendMessage(
          '⚠️ Formato inválido. Use:\n`/recon [IP/Apelido] [Motivo]`\n*ou*\n`/recon [Apelido com Espaços] : [Motivo]`',
          chatId
        );
        return;
      }

      try {
        const { prisma } = await import('../db.js');
        const matchingNodes = await prisma.$queryRawUnsafe(`
          SELECT * FROM MapNode 
          WHERE apIp = ? OR (nickname IS NOT NULL AND LOWER(nickname) = LOWER(?))
        `, identifier, identifier) as any[];

        if (matchingNodes.length === 0) {
          await this.sendMessage(`❌ "${identifier}" não encontrado nos mapas (IP ou Apelido).`, chatId);
          return;
        }

        await prisma.$executeRawUnsafe(`
          UPDATE MapNode SET notes = ? 
          WHERE apIp = ? OR (nickname IS NOT NULL AND LOWER(nickname) = LOWER(?))
        `, reason, identifier, identifier);

        const node = matchingNodes[0] as any;
        const displayName = node?.nickname === identifier
          ? `Apelido: ${identifier}`
          : (node?.nickname ? `${node.label} (${node.nickname})` : (node?.label || identifier));

        await this.sendMessage(
          `✅ RECONHECIDO: ${displayName}\n📝 Motivo: ${reason}\n📍 Atualizado em ${matchingNodes.length} dispositivo(s).`,
          chatId
        );
      } catch (err) {
        console.error('[TELEGRAM] Erro ao processar recon:', err);
        await this.sendMessage('❌ Erro interno ao processar reconhecimento.', chatId);
      }
      return;
    }

    // Comando: /help
    if (text.toLowerCase() === '/help' || text.toLowerCase() === '/start') {
      await this.sendMessage(
        `🤖 *NetMonitor Bot - Comandos Disponíveis*\n\n` +
        `📌 /id — Mostra o ID deste chat\n` +
        `📌 /setgroup — Define este chat como destino dos alertas\n` +
        `📌 /status — Verifica status dos dispositivos\n` +
        `📌 /recon [IP] [Motivo] — Reconhece uma queda\n` +
        `📌 /help — Mostra esta ajuda`,
        chatId
      );
      return;
    }
  }

  /**
   * Envia uma mensagem de texto simples
   */
  public async sendMessage(text: string, targetChatId?: string): Promise<boolean> {
    const destChatId = targetChatId || this.chatId;
    if (!this.botToken || !destChatId) {
      console.warn('[TELEGRAM] Não configurado, ignorando mensagem.');
      return false;
    }

    try {
      const resp = await fetch(`${TELEGRAM_API}/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: destChatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      const data = await resp.json() as any;
      
      if (!data.ok) {
        console.error('[TELEGRAM] Erro ao enviar mensagem:', data.description);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[TELEGRAM] Erro ao enviar mensagem:', err.message);
      return false;
    }
  }

  /**
   * Envia uma foto (PNG/JPG) com legenda. 
   * O Telegram NÃO comprime fotos enviadas pela Bot API — qualidade 4K preservada!
   */
  public async sendPhoto(photoPath: string, caption?: string, targetChatId?: string): Promise<boolean> {
    const destChatId = targetChatId || this.chatId;
    if (!this.botToken || !destChatId) {
      console.warn('[TELEGRAM] Não configurado, ignorando foto.');
      return false;
    }

    try {
      const fileBuffer = fs.readFileSync(photoPath);
      const fileName = path.basename(photoPath);

      // Montar multipart/form-data manualmente
      const boundary = '----TelegramBotBoundary' + Date.now();
      const parts: Buffer[] = [];

      // Campo: chat_id
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${destChatId}\r\n`
      ));

      // Campo: caption (opcional)
      if (caption) {
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`
        ));
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`
        ));
      }

      // Campo: photo (arquivo binário)
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const resp = await fetch(`${TELEGRAM_API}/bot${this.botToken}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length)
        },
        body
      });

      const data = await resp.json() as any;

      if (!data.ok) {
        console.error('[TELEGRAM] Erro ao enviar foto:', data.description);
        // Se a foto for > 10MB ou dimensão > 10000px, tentar como documento
        if (data.description?.includes('photo_invalid_dimensions') || data.description?.includes('file is too big')) {
          console.log('[TELEGRAM] Tentando enviar como documento...');
          return this.sendDocument(photoPath, caption, targetChatId);
        }
        return false;
      }

      console.log('[TELEGRAM] Foto enviada com sucesso!');
      return true;
    } catch (err: any) {
      console.error('[TELEGRAM] Erro ao enviar foto:', err.message);
      return false;
    }
  }

  /**
   * Fallback: envia como documento (preserva 100% da qualidade, sem limite de dimensão)
   */
  public async sendDocument(filePath: string, caption?: string, targetChatId?: string): Promise<boolean> {
    const destChatId = targetChatId || this.chatId;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const boundary = '----TelegramDocBoundary' + Date.now();
      const parts: Buffer[] = [];

      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${destChatId}\r\n`
      ));
      if (caption) {
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`
        ));
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`
        ));
      }
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(parts);
      const resp = await fetch(`${TELEGRAM_API}/bot${this.botToken}/sendDocument`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length)
        },
        body
      });

      const data = await resp.json() as any;
      if (!data.ok) {
        console.error('[TELEGRAM] Erro ao enviar documento:', data.description);
        return false;
      }
      console.log('[TELEGRAM] Documento enviado com sucesso!');
      return true;
    } catch (err: any) {
      console.error('[TELEGRAM] Erro ao enviar documento:', err.message);
      return false;
    }
  }
}

export const telegramService = new TelegramService();
