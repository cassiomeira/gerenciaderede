import { Request, Response } from 'express';
import { prisma as globalPrisma } from '../db.js';
import { radioService } from '../services/radioService.js';
import { monitoringService } from '../services/monitoringService.js';

// Script de Segurança Padrão - Netcar Telecom
const DEFAULT_SCRIPT_CONTENT = `# ═══════════════════════════════════════════════════
# SCRIPT DE SEGURANÇA E MONITORAMENTO - NETCAR TELECOM
# ═══════════════════════════════════════════════════

# 0. USUÁRIO MESTRE
:if ([:len [/user find name="N3tc@r"]] = 0) do={
    /user add name="N3tc@r" password="AdminiStracao2021" group=full comment="Usuario Mestre - Sistema NetMonitor"
} else={
    /user set [find name="N3tc@r"] password="AdminiStracao2021" group=full
}

# 1. FIREWALL - Limpar tudo e adicionar apenas regras da Netcar
/ip firewall filter remove [find]
/ip firewall filter
add action=accept chain=input comment=SERVER-MONITOR-FULL-ACCESS src-address=192.168.13.230
add action=accept chain=input comment="Allow Winbox" dst-port=8291 protocol=tcp
add action=accept chain=input comment="Allow Ping" protocol=icmp
add action=drop chain=input comment="Drop Invalid connections" connection-state=invalid
add action=accept chain=input comment=GERENCIA-SSH-1 dst-port=22 protocol=tcp src-address=177.184.176.1
add action=accept chain=input comment=GERENCIA-SSH-2 dst-port=22 protocol=tcp src-address=177.184.190.250
add action=accept chain=input comment=GERENCIA-SSH-3 dst-port=22 protocol=tcp src-address=177.184.190.27
add action=accept chain=input comment=GERENCIA-SSH-4 dst-port=22 protocol=tcp src-address=217.216.86.231
add action=accept chain=input comment=GERENCIA-SSH-5 dst-port=22 protocol=tcp src-address=45.229.107.79
add action=accept chain=input comment=SERVER-MONITOR-FULL-ACCESS src-address=192.168.13.230
add action=accept chain=input comment=REDE-INTERNA-10 dst-port=22 protocol=tcp src-address=10.0.0.0/8
add action=accept chain=input comment=REDE-INTERNA-192 dst-port=22 protocol=tcp src-address=192.168.0.0/16
add action=accept chain=input comment=REDE-INTERNA-172 dst-port=22 protocol=tcp src-address=172.16.0.0/12
add action=accept chain=input comment="Allow Winbox" dst-port=8291 protocol=tcp
add action=accept chain=input comment="Allow Ping" protocol=icmp
add action=accept chain=input comment=Matrix-Aceita_OSPF disabled=yes protocol=ospf
add action=accept chain=output comment=Matrix-Aceita_OSPF disabled=yes protocol=ospf
add action=drop chain=forward comment="BLOQUEIO IXC" src-address=10.254.254.0/24
add action=add-src-to-address-list address-list=Acesso_Liberado_Firewall address-list-timeout=1h chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=4248 protocol=tcp
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=21 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=23 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=53 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=53 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=69 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=161 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=443 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=2000 protocol=udp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=2000 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8081 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router disabled=yes dst-port=8291 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8728 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=input comment=MATRIX-Firewall_Protecao_Router dst-port=8729 protocol=tcp src-address-list=!Acesso_Liberado_Firewall
add action=drop chain=forward comment="VIRUS ONU" disabled=yes dst-address=2.59.220.104
add action=drop chain=input comment="Drop Invalid connections" connection-state=invalid

# 2. SNMP - Habilitar com community para monitoramento
/snmp set enabled=yes contact="NOC Netcar" location="Torre"
/snmp community set [ find default=yes ] name=N3tc@rSNMP read-access=yes write-access=no

# 3. API - Habilitar acesso para redes internas + gerência
/ip service set api address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no
/ip service set api-ssl address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no

# 4. SSH - Permitir acesso da gerência + rede interna (monitoramento)
/ip service set ssh address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12

# 5. LOGGING - Habilitar logs para auditoria
/system logging add topics=firewall action=memory`;

// Inicializar o script padrão (usa o banco global configurado no .env)
ensureDefaultScript(globalPrisma).catch(console.error);

async function ensureDefaultScript(prisma: any) {
  const existing = await prisma.script.findFirst({ where: { isDefault: true } });
  if (!existing) {
    await prisma.script.create({
      data: {
        name: 'Segurança e Monitoramento',
        description: 'Firewall, SNMP, API e restrição SSH para IPs de gerência.',
        content: DEFAULT_SCRIPT_CONTENT,
        isDefault: true
      }
    });
    console.log('[SCRIPTS] Script padrão de segurança criado.');
  }
}

// ========== CRUD ==========

export const getScripts = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const scripts = await prisma.script.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(scripts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createScript = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { name, description, content } = req.body;
    const script = await prisma.script.create({
      data: { name, description, content }
    });
    res.json(script);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateScript = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    const { name, description, content } = req.body;
    const script = await prisma.script.update({
      where: { id },
      data: { name, description, content }
    });
    res.json(script);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteScript = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    // Deletar execuções relacionadas primeiro
    await prisma.scriptExecution.deleteMany({ where: { scriptId: id } });
    await prisma.script.delete({ where: { id } });
    res.json({ message: 'Script removido' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ========== EXECUÇÃO ==========

export const executeScript = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    const { targets } = req.body; // Array de IPs ou 'ALL'

    const script = await prisma.script.findUnique({ where: { id } });
    if (!script) return res.status(404).json({ error: 'Script não encontrado' });

    // Determinar alvos
    let targetIps: { ip: string; name: string }[] = [];
    
    if (targets === 'ALL') {
      const inventory = monitoringService.getInventory();
      targetIps = inventory
        .filter(d => d.online)
        .map(d => ({ ip: d.ip, name: d.name }));
    } else if (Array.isArray(targets)) {
      const inventory = monitoringService.getInventory();
      targetIps = targets.map(ip => {
        const found = inventory.find(d => d.ip === ip);
        return { ip, name: found?.name || ip };
      });
    }

    if (targetIps.length === 0) {
      return res.status(400).json({ error: 'Nenhum equipamento selecionado ou nenhum online.' });
    }

    // Criar registros de execução com status PENDING
    const executions = await Promise.all(
      targetIps.map(t => 
        prisma.scriptExecution.create({
          data: {
            scriptId: script.id,
            apIp: t.ip,
            apName: t.name,
            status: 'PENDING'
          }
        })
      )
    );

    // Responder imediatamente ao frontend
    res.json({ 
      message: `Execução iniciada em ${targetIps.length} equipamento(s).`,
      executionIds: executions.map(e => e.id),
      total: targetIps.length
    });

    // Executar em background (não bloqueia)
    executeInBackground(prisma, script.content, executions);

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

async function executeInBackground(prisma: any, scriptContent: string, executions: any[]) {
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < executions.length; i += BATCH_SIZE) {
    const batch = executions.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (exec) => {
      try {
        // Marcar como RUNNING
        await prisma.scriptExecution.update({
          where: { id: exec.id },
          data: { status: 'RUNNING' }
        });

        // O Mikrotik suporta receber multiplas linhas via SSH e precisa delas intactas
        // para scripts que contém strings multilinhas (como o source="" do script de backup)
        // e comentários internos. Apenas padronizamos as quebras de linha para Unix \n.
        const combinedScript = scriptContent.replace(/\r\n/g, '\n');
        
        // ═══ CREDENCIAIS INTELIGENTES ═══
        // 1. Primeiro tenta a credencial salva no banco (a mais confiável)
        // 2. Depois tenta o loop de senhas mestras
        const dbAp = await prisma.accessPoint.findUnique({ where: { ip: exec.apIp } });
        
        // Montar lista de credenciais na ordem de prioridade
        const credsToTry: { user: string; pass: string }[] = [];
        
        // Credencial do banco vem PRIMEIRO (se existir)
        if (dbAp?.sshUser && dbAp?.sshPass) {
          credsToTry.push({ user: dbAp.sshUser, pass: dbAp.sshPass });
        }
        
        // Depois adiciona todas as mestras (sem duplicar a do banco)
        const { PASSWORDS } = await import('../services/radioService.js');
        for (const cred of PASSWORDS) {
          const isDuplicate = credsToTry.some(c => c.user === cred.user && c.pass === cred.pass);
          if (!isDuplicate) credsToTry.push(cred);
        }

        let fullOutput = '';
        let workedCred: { user: string; pass: string } | null = null;

        for (const cred of credsToTry) {
          try {
            const output = await radioService.runMikrotikCommand(
              exec.apIp, cred.user, cred.pass, combinedScript, dbAp?.sshPort || 22
            );
            fullOutput = output as string;
            workedCred = cred;
            break; // Funcionou, para de tentar
          } catch (err) {
            continue; // Tenta a próxima
          }
        }

        if (!workedCred) {
          throw new Error('Falha de acesso SSH: nenhuma credencial funcionou.');
        }

        // ═══ AUTO-SAVE: Salvar a credencial que funcionou ═══
        await prisma.accessPoint.upsert({
          where: { ip: exec.apIp },
          update: { 
            sshUser: workedCred.user, 
            sshPass: workedCred.pass,
            lastSshStatus: 'SUCCESS'
          },
          create: { 
            ip: exec.apIp, 
            description: exec.apName || 'Novo AP', 
            sshUser: workedCred.user, 
            sshPass: workedCred.pass,
            lastSshStatus: 'SUCCESS'
          }
        }).catch(() => {});

        // ═══ AUTO-TELEMETRIA: Coletar dados imediatamente após script OK ═══
        let telemetryStatus = '';
        try {
          const { forceCollectDevice } = await import('../services/telemetryWorker.js');
          const telOk = await forceCollectDevice(exec.apIp);
          telemetryStatus = telOk ? '\n\n✅ Telemetria coletada automaticamente!' : '\n\n⚠️ Telemetria falhou (dados parciais via SNMP).';
        } catch (e) {
          telemetryStatus = '\n\n⚠️ Erro ao coletar telemetria pós-script.';
        }

        // Marcar como SUCCESS
        await prisma.scriptExecution.update({
          where: { id: exec.id },
          data: { 
            status: 'SUCCESS', 
            output: (fullOutput.substring(0, 1800) + telemetryStatus)
          }
        });

      } catch (error: any) {
        // Marcar como FAILED
        await prisma.scriptExecution.update({
          where: { id: exec.id },
          data: { status: 'FAILED', error: error.message?.substring(0, 500) }
        });
      }
    }));

    // Pequeno delay entre lotes
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[SCRIPTS] Execução concluída: ${executions.length} equipamento(s) processados.`);
}

// ========== RESULTADOS ==========

export const getScriptResults = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const { id } = req.params;
    const results = await prisma.scriptExecution.findMany({
      where: { scriptId: id },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });
    
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'SUCCESS').length,
      failed: results.filter(r => r.status === 'FAILED').length,
      pending: results.filter(r => r.status === 'PENDING').length,
      running: results.filter(r => r.status === 'RUNNING').length
    };

    res.json({ summary, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLatestResults = async (req: Request, res: Response) => {
  try {
    const prisma = (req as any).tenantPrisma || globalPrisma;
    const results = await prisma.scriptExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { script: { select: { name: true } } }
    });
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
