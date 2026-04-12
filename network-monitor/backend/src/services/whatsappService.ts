import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';

class WhatsAppService {
  private client: any;
  private qrCode: string | null = null;
  private isReady = false;

  constructor() {
    const sessionPath = path.resolve(process.cwd(), 'whatsapp-session');
    console.log('[WHATSAPP] Session path:', sessionPath);
    
    this.client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: 'network-monitor',
        dataPath: sessionPath 
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // can help in some restricted environments
          '--disable-gpu'
        ],
        handleSIGINT: false,
      }
    });

    this.setupEvents();
  }

  private setupEvents() {
    console.log('[WHATSAPP] Registrando handlers de eventos...');
    
    this.client.on('qr', (qr: string) => {
      console.log('[WHATSAPP] >>> NOVO QR CODE RECEBIDO NO BACKEND <<<');
      this.qrCode = qr;
    });

    this.client.on('loading_screen', (percent: string, message: string) => {
      console.log(`[WHATSAPP] Status de Carga: ${percent}% - ${message}`);
    });

    this.client.on('ready', () => {
      console.log('[WHATSAPP] >>> CLIENTE PRONTO E CONECTADO <<<');
      this.qrCode = null;
      this.isReady = true;
    });

    this.client.on('authenticated', () => {
      console.log('[WHATSAPP] Autenticação confirmada.');
      this.qrCode = null;
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('[WHATSAPP] ERRO DE AUTENTICAÇÃO:', msg);
      this.qrCode = null;
    });

    this.client.on('disconnected', (reason: string) => {
      console.warn('[WHATSAPP] CLIENTE DESCONECTADO. Motivo:', reason);
      this.isReady = false;
      this.qrCode = null;
      setTimeout(() => {
        console.log('[WHATSAPP] Tentando reiniciar após queda...');
        this.client.initialize().catch((err: any) => console.error('[WHATSAPP] Erro de reinício:', err));
      }, 5000);
    });

    // Eventos extras para debug de hang
    this.client.on('change_state', (state: any) => {
      console.log('[WHATSAPP] Mudança de Estado:', state);
    });

    this.client.on('message', async (msg: any) => {
       const chat = await msg.getChat();
       console.log(`[WHATSAPP] Mensagem de ${msg.from} (Chat: ${chat.name || 'Privado'}): ${msg.body}`);
       
       if (msg.body.toLowerCase() === 'id') {
         await msg.reply(`O ID deste chat é: ${chat.id._serialized}`);
       }

       if (msg.body.toLowerCase().startsWith('setgroup ')) {
         const newId = msg.body.split(' ')[1];
         const { alertManager } = await import('./alertManager.js');
         alertManager.setAlertGroup(newId);
         await msg.reply(`✅ Grupo de alertas configurado para: ${newId}`);
       }

       if (msg.body.toLowerCase().startsWith('recon ')) {
         const fullText = msg.body.substring(6).trim();
         let identifier = '';
         let reason = '';

         // Suporte a separador ":" para apelidos com espaços
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
           await msg.reply('⚠️ Formato inválido. Use:\nrecon [IP/Apelido] [Motivo]\n*ou*\nrecon [Apelido com Espaços] : [Motivo]');
           return;
         }
         
         const { prisma } = await import('../db.js');
         try {
           // Usar raw SQL para buscar e atualizar, ignorando limitações do client Prisma
           const matchingNodes = await prisma.$queryRawUnsafe(`
             SELECT * FROM MapNode 
             WHERE apIp = ? OR (nickname IS NOT NULL AND LOWER(nickname) = LOWER(?))
           `, identifier, identifier) as any[];

           if (matchingNodes.length === 0) {
             await msg.reply(`❌ "${identifier}" não encontrado nos mapas (IP ou Apelido).`);
             return;
           }

           await prisma.$executeRawUnsafe(`
             UPDATE MapNode SET notes = ? 
             WHERE apIp = ? OR (nickname IS NOT NULL AND LOWER(nickname) = LOWER(?))
           `, reason, identifier, identifier);
           
           const resultCount = matchingNodes.length;
           const node = matchingNodes[0];
           const displayName = node?.nickname === identifier 
             ? `Apelido: ${identifier}` 
             : (node?.nickname ? `${node.label} (${node.nickname})` : (node?.label || identifier));
                
           await msg.reply(`✅ RECONHECIDO: ${displayName}\n📝 Motivo: ${reason}\n📍 Atualizado em ${resultCount} dispositivo(s).`);
         } catch (err) {
           console.error('[WHATSAPP] Erro ao processar recon:', err);
           await msg.reply('❌ Erro interno ao processar reconhecimento.');
         }
       }
    });
  }

  public async initialize() {
    try {
      console.log('[WHATSAPP] Inicializando cliente...');
      // Garantir que não estamos presos em uma anterior
      if (this.isReady) {
        console.log('[WHATSAPP] Cliente já estava pronto, ignorando nova inicialização.');
        return;
      }
      
      // Alguns ambientes precisam de um pequeno delay para carregar arquivos de sessão
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.client.initialize();
      console.log('[WHATSAPP] Chamada de inicialização disparada.');
    } catch (err) {
      console.error('[WHATSAPP] Erro CRÍTICO ao inicializar:', err);
    }
  }

  public getQrCode() {
    return this.qrCode;
  }

  public getStatus() {
    return {
      connected: this.isReady,
      hasQr: !!this.qrCode
    };
  }

  public async sendMessage(to: string, message: string, media?: any) {
    if (!this.isReady) throw new Error('WhatsApp não está pronto');
    
    // Formatar número (remover caracteres e adicionar @c.us ou @g.us)
    const chatId = to.includes('@') ? to : `${to}@c.us`;
    
    if (media) {
      return await this.client.sendMessage(chatId, media, { caption: message });
    }
    return await this.client.sendMessage(chatId, message);
  }
}

export const whatsappService = new WhatsAppService();
