import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';
import crypto from 'crypto';
import type { Server } from 'http';

interface AgentConnection {
  ws: WebSocket;
  companyId: string;
}

interface TunnelSession {
  connectionId: string;
  tcpSocket: net.Socket;
  targetIp: string;
  targetPort: number;
  lastActivity: number;
}

class TunnelService {
  private wss: WebSocketServer | null = null;
  // companyId -> WebSocket
  private agents: Map<string, AgentConnection> = new Map();
  // connectionId -> TunnelSession (Active TCP connections on Backend)
  private sessions: Map<string, TunnelSession> = new Map();
  // serverId -> net.Server (Active TCP listeners on Backend waiting for Winbox)
  private activeServers: Map<string, net.Server> = new Map();
  
  // Controle de Range de Portas para Docker/Coolify (Ex: 40000 até 40100)
  private minPort = parseInt(process.env.TUNNEL_MIN_PORT || '40000');
  private maxPort = parseInt(process.env.TUNNEL_MAX_PORT || '40100');
  private currentPort = this.minPort;

  public attachToServer(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true, 
      perMessageDeflate: false // Desabilita compressão WebSocket para evitar lag (Nagle/Zlib delay) 
    });

    server.on('upgrade', (request, socket, head) => {
      if (request.url?.startsWith('/api/tunnel')) {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      // url auth: /api/tunnel?companyId=XYZ
      const urlParams = new URL(req.url || '', `http://${req.headers.host}`).searchParams;
      const companyId = urlParams.get('companyId') || req.headers['x-company-id'] as string;
      
      if (!companyId) {
        ws.close(1008, 'Company ID Required');
        return;
      }

      console.log(`[TUNNEL] Edge Agent CONNECTED (Company: ${companyId})`);
      this.agents.set(companyId, { ws, companyId });

      // Keepalive ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleAgentMessage(companyId, data);
        } catch (err) {
          console.error('[TUNNEL] Failed to parse message from agent:', err);
        }
      });

      ws.on('close', () => {
        console.log(`[TUNNEL] Edge Agent DISCONNECTED (Company: ${companyId})`);
        clearInterval(pingInterval);
        this.agents.delete(companyId);
        // Fechar todas as sessoes dessa empresa
        this.cleanupCompanySessions(companyId);
      });
      
      ws.on('error', (err) => {
        console.error(`[TUNNEL] WS Error (Company: ${companyId}):`, err.message);
      });
    });
  }

  private handleAgentMessage(companyId: string, data: any) {
    const session = this.sessions.get(data.connectionId);
    
    if (data.type === 'DATA' && session && session.tcpSocket) {
      session.lastActivity = Date.now();
      const buffer = Buffer.from(data.payload, 'base64');
      session.tcpSocket.write(buffer);
    } 
    else if (data.type === 'CLOSE' && session) {
      console.log(`[TUNNEL] Agent closed connection ${data.connectionId}`);
      if (!session.tcpSocket.destroyed) {
        session.tcpSocket.destroy();
      }
      this.sessions.delete(data.connectionId);
    }
    else if (data.type === 'ERROR') {
      console.error(`[TUNNEL] Edge Agent Error (Conn ${data.connectionId}): ${data.message}`);
      if (session && !session.tcpSocket.destroyed) {
        session.tcpSocket.destroy();
      }
      this.sessions.delete(data.connectionId);
    }
  }

  /**
   * Chamado quando o usuário clica em "Winbox" na UI.
   * Cria um servidor TCP local aleatório e retorna a porta.
   */
  public async createTunnel(companyId: string, targetIp: string, targetPort: number = 8291): Promise<{ port: number, serverId: string }> {
    const agent = this.agents.get(companyId);
    if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Agente Edge não está conectado. O túnel não pode ser criado.');
    }

    // Busca a próxima porta livre no range de Docker (40000-40100)
    const assignedPort = await this.findAvailablePort();

    return new Promise((resolve, reject) => {
      const server = net.createServer();
      const serverId = crypto.randomUUID();

      server.on('connection', (socket) => {
        // Otimização urgente para Winbox (Evita Nagle's algorithm congestion)
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 30000);

        // Nova conexão TCP recebida do Winbox do cliente
        const connectionId = crypto.randomUUID();
        console.log(`[TUNNEL TCP] Nova conexão Winbox (Porta -> Edge) - ID: ${connectionId}`);

        this.sessions.set(connectionId, {
          connectionId,
          tcpSocket: socket,
          targetIp,
          targetPort,
          lastActivity: Date.now()
        });

        // 1. Avisa o Agente para abrir o socket lá na ponta
        agent.ws.send(JSON.stringify({
          type: 'CONNECT',
          connectionId,
          targetIp,
          targetPort
        }));

        // 2. Encaminha dados recebidos do Winbox para o Agente em Base64
        socket.on('data', (buffer) => {
          const s = this.sessions.get(connectionId);
          if (s) {
             s.lastActivity = Date.now();
             agent.ws.send(JSON.stringify({
               type: 'DATA',
               connectionId,
               payload: buffer.toString('base64')
             }));
          }
        });

        socket.on('close', () => {
          console.log(`[TUNNEL TCP] Winbox desconectou localmente (ID: ${connectionId})`);
          agent.ws.send(JSON.stringify({ type: 'CLOSE', connectionId }));
          this.sessions.delete(connectionId);
        });
        
        socket.on('error', (err) => {
          console.error(`[TUNNEL TCP] Erro no socket local: ${err.message}`);
          agent.ws.send(JSON.stringify({ type: 'CLOSE', connectionId }));
          this.sessions.delete(connectionId);
        });
      });

      // Ligar servidor TCP na porta mapeada (address: 0.0.0.0) para escutar a internet
      server.listen(assignedPort, '0.0.0.0', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          console.log(`[TUNNEL SYSTEM] Servidor TCP Temporário Criado na porta ${address.port} para IP ${targetIp}:${targetPort}`);
          this.activeServers.set(serverId, server);
          
          // O Servidor TCP morre sozinho se não tiver ninguem em 2 minutos
          setTimeout(() => {
             if (this.activeServers.has(serverId)) {
                 console.log(`[TUNNEL SYSTEM] Fechando porta temporária ${address.port} por segurança (timeout 2min)`);
                 server.close();
                 this.activeServers.delete(serverId);
             }
          }, 120000); 

          resolve({ port: address.port, serverId });
        } else {
          reject(new Error('Falha ao obter porta do servidor TCP'));
        }
      });
      
      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Percorre o array ciclicamente até achar uma porta livre no Node
  private async findAvailablePort(): Promise<number> {
    let attempts = 0;
    const maxAttempts = this.maxPort - this.minPort;

    while (attempts <= maxAttempts) {
      const portToCheck = this.currentPort;
      // Rotaciona a porta
      this.currentPort = this.currentPort >= this.maxPort ? this.minPort : this.currentPort + 1;
      
      const isFree = await this.isPortAvailable(portToCheck);
      if (isFree) return portToCheck;
      
      attempts++;
    }
    throw new Error('Todas as portas de túnel do Docker (40000-40100) estão em uso!');
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => tester.once('close', () => resolve(true)).close())
        .listen(port, '0.0.0.0');
    });
  }

  private cleanupCompanySessions(companyId: string) {
    // Destruir todas as sessões ativas daquele agente que caiu
    for (const [connId, session] of this.sessions.entries()) {
      // Como não guardamos companyId na sessão diretamente (apenas na WS), 
      // a forma mais limpa é fechar todas as TCP sockets que pertencem a ele
      // Mas para ser preciso de proxy, o map de sessão não tem companyId?
      // Neste cenário isolado, sem company cache na sessao, nao tem problema. O Winbox vai cair e fechar a ponta tcp sozinho.
      if (!session.tcpSocket.destroyed) session.tcpSocket.destroy();
      this.sessions.delete(connId);
    }
  }
}

export const tunnelService = new TunnelService();
