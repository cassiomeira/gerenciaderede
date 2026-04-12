const content = `# =========================================================================
# SCRIPT SUPREMO: FIREWALL, WINBOX, SNMP E BACKUP PERFEITO
# =========================================================================

# 1. SERVICOS E PROTECAO
/ip service set api address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,192.168.13.230/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no port=8728
/ip service set api-ssl address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,192.168.13.230/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no port=8729
/ip service set ssh address=177.184.176.1/32,177.184.190.250/32,177.184.190.27/32,217.216.86.231/32,45.229.107.79/32,192.168.13.230/32,10.0.0.0/8,192.168.0.0/16,172.16.0.0/12 disabled=no port=22
/ip service set winbox disabled=no port=8291

/snmp set enabled=yes contact="NOC Netcar" location="Torre" trap-version=2
/snmp community remove [find]
/snmp community add name=N3tc@rSNMP read-access=yes
/system logging add topics=firewall action=memory

/ip firewall filter
add chain=input src-address=177.184.176.1 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-1"
add chain=input src-address=177.184.190.250 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-2"
add chain=input src-address=177.184.190.27 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-3"
add chain=input src-address=217.216.86.231 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-4"
add chain=input src-address=45.229.107.79 protocol=tcp dst-port=22 action=accept comment="GERENCIA-SSH-5"
add chain=input src-address=192.168.13.230 action=accept comment="SERVER-MONITOR-FULL-ACCESS"
add chain=input src-address=10.0.0.0/8 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-10"
add chain=input src-address=192.168.0.0/16 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-192"
add chain=input src-address=172.16.0.0/12 protocol=tcp dst-port=22 action=accept comment="REDE-INTERNA-172"
add action=accept chain=input comment="Allow Winbox" dst-port=8291 protocol=tcp
add action=accept chain=input comment="Allow Ping" protocol=icmp
add action=drop chain=input comment="Drop Invalid connections" connection-state=invalid

# 2. DATA/HORA
/system ntp client set enabled=yes primary-ntp=200.160.7.186 secondary-ntp=200.160.0.8
/system clock set time-zone-name=America/Sao_Paulo

# 3. BACKUP (BASEADO NO SCRIPT VALIDADO PELO USUARIO + NOME/IP NO ARQUIVO)
/system script remove [find name="auto_backup_ftp"]
/system script add name="auto_backup_ftp" source="/file remove [find name~\\".backup\\"]; /file remove [find name~\\".rsc\\"]; :local routerName [/system identity get name]; :local routerIP \\"\\"; :foreach i in=[/ip address find disabled=no dynamic=no] do={ :if ([:len \\$routerIP] = 0) do={ :local raw [/ip address get \\$i address]; :set routerIP [:pick \\$raw 0 [:find \\$raw \\"/\\"]]; } }; :local date [/system clock get date]; :local fixedDate [:pick \\$date 0 3][:pick \\$date 4 6][:pick \\$date 7 11]; :local filename (\\$routerName . \\"_\\" . \\$routerIP . \\"_\\" . \\$fixedDate); /system backup save name=\\$filename password=10025-MATRIX; /export show-sensitive file=\\$filename; :delay 5s; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\".backup\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\".backup\\") upload=yes; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\".rsc\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\".rsc\\") upload=yes; :delay 5s; /file remove [find name=(\\$filename . \\".backup\\")]; /file remove [find name=(\\$filename . \\".rsc\\")];"

/system scheduler remove [find name="schedule_backup_ftp"]
/system scheduler add name="schedule_backup_ftp" interval=1d start-time=03:00:00 on-event="auto_backup_ftp"
`;

async function apply() {
  try {
    const res = await fetch('http://localhost:3001/api/scripts');
    const scripts = await res.json();
    for (const s of scripts) {
      if (s.name.includes('Supremo') || s.name.includes('Mestre') || s.name.includes('Segurança e Monitoramento')) {
        await fetch('http://localhost:3001/api/scripts/' + s.id, { method: 'DELETE' });
      }
    }
    const createRes = await fetch('http://localhost:3001/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Supremo Final: Firewall, SNMP e Backup Otimizado',
        description: 'Bloqueio de seguranca + Data/Hora Brasil + Limpeza total de backups antigos na memoria + Envio FTP (mikrotik owner).',
        content: content
      })
    });
    console.log(await createRes.json());
  } catch (err) {
    console.error(err);
  }
}
apply();
