import WebSocket from 'ws';
import net from 'net';

export class TunnelClient {
  private ws: WebSocket | null = null;
  private url: string;
  private secret: string;
  private companyId: string;
  private reconnecting = false;
  
  // connectionId -> Local TCP Socket
  private tcpSockets: Map<string, net.Socket> = new Map();

  constructor(cloudUrl: string, secret: string, companyId: string) {
    // Transforma http://.../api em ws://.../api/tunnel
    const wsUrl = cloudUrl.replace(/^http/, 'ws') + '/tunnel?companyId=' + encodeURIComponent(companyId);
    this.url = wsUrl;
    this.secret = secret;
    this.companyId = companyId;
  }

  public connect() {
    console.log(`[TUNNEL] Conectando ao Cloud Backend WebSocket... (${this.url})`);
    
    this.ws = new WebSocket(this.url, {
      perMessageDeflate: false, // Desabilita compressão para reduzir lag de latência 
      headers: {
        'x-internal-secret': this.secret,
        'x-company-id': this.companyId
      }
    });

    this.ws.on('open', () => {
      console.log('[TUNNEL] Conectado ao Cloud Backend com sucesso!');
      this.reconnecting = false;
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleTunnelMessage(msg);
      } catch (err) {
        console.error('[TUNNEL] Erro ao parsear mensagem do servidor:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[TUNNEL] Conexão WS com o servidor caiu.');
      this.cleanupAllSockets();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[TUNNEL] Erro no WebSocket:', err.message);
    });
  }

  private scheduleReconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    console.log('[TUNNEL] Tentando reconectar em 10 segundos...');
    setTimeout(() => {
      this.connect();
    }, 10000);
  }

  private handleTunnelMessage(msg: any) {
    const { type, connectionId, targetIp, targetPort, payload } = msg;

    if (type === 'CONNECT') {
      console.log(`[TUNNEL TCP] Solicitada conexão TCP para ${targetIp}:${targetPort} (ID: ${connectionId})`);
      
      const socket = new net.Socket();
      socket.setNoDelay(true); // Desabilita Nagle's algorithm para menor latência
      socket.setKeepAlive(true, 30000); // Mantém a conexão ativa
      
      this.tcpSockets.set(connectionId, socket);

      socket.connect(targetPort, targetIp, () => {
        console.log(`[TUNNEL TCP] Conectado localmente a ${targetIp}:${targetPort}`);
        // Se a gente quiser enviar um CONNECTED de volta pro backend, pode, 
        // mas o proxy não precisa se o data já vai direto
      });

      socket.on('data', (data) => {
        // Enviar fluxo de volta para a nuvem
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'DATA',
            connectionId,
            payload: data.toString('base64')
          }));
        }
      });

      socket.on('close', () => {
        console.log(`[TUNNEL TCP] Conexão local fechada: ${targetIp}:${targetPort}`);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'CLOSE', connectionId }));
        }
        this.tcpSockets.delete(connectionId);
      });

      socket.on('error', (err) => {
        console.error(`[TUNNEL TCP] Erro ao conectar localmente em ${targetIp}:${targetPort}: ${err.message}`);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ERROR', connectionId, message: err.message }));
        }
        socket.destroy();
        this.tcpSockets.delete(connectionId);
      });
    } 
    else if (type === 'DATA') {
      const socket = this.tcpSockets.get(connectionId);
      if (socket && !socket.destroyed) {
        socket.write(Buffer.from(payload, 'base64'));
      } else {
        console.log(`[TUNNEL] Recebido DATA para socket inexistente ou destruído (ID: ${connectionId})`);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
           this.ws.send(JSON.stringify({ type: 'CLOSE', connectionId }));
        }
      }
    } 
    else if (type === 'CLOSE') {
      const socket = this.tcpSockets.get(connectionId);
      if (socket) {
        console.log(`[TUNNEL] Nuvem solicitou encerramento do TCP (ID: ${connectionId})`);
        socket.destroy();
        this.tcpSockets.delete(connectionId);
      }
    }
  }

  private cleanupAllSockets() {
    for (const [id, socket] of this.tcpSockets.entries()) {
      if (!socket.destroyed) socket.destroy();
      this.tcpSockets.delete(id);
    }
  }
}
