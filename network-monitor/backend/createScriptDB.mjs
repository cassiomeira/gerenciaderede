const content = `# Script de Protecao e Backup Automatico via FTP

# 1. Protecao de Firewall contra ataques
/ip firewall filter
add action=drop chain=input comment=\"Drop Invalid connections\" connection-state=invalid
add action=accept chain=input comment=\"Allow Winbox\" dst-port=8291 protocol=tcp
add action=accept chain=input comment=\"Allow Ping\" protocol=icmp

# 2. Configurando o Backup Diario e Upload via FTP
/system script remove [find name=\"auto_backup_ftp\"]
/system script add name=\"auto_backup_ftp\" source=\":local routerName [/system identity get name]; :local date [/system clock get date]; :local fixedDate [:pick \\$date 0 3][:pick \\$date 4 6][:pick \\$date 7 11]; :local filename (\\$routerName . \\\"-\\\" . \\$fixedDate); /system backup save name=\\$filename; /export show-sensitive file=\\$filename; :delay 5s; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\\".backup\\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\\".backup\\\") upload=yes; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\\".rsc\\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\\".rsc\\\") upload=yes; :delay 5s; /file remove [find name=(\\$filename . \\\".backup\\\")]; /file remove [find name=(\\$filename . \\\".rsc\\\")];\"

# 3. Agendador para rodar as 03:00 da manha
/system scheduler remove [find name=\"schedule_backup_ftp\"]
/system scheduler add name=\"schedule_backup_ftp\" interval=1d start-time=03:00:00 on-event=\"auto_backup_ftp\"
`;

async function addScript() {
  try {
    const res = await fetch('http://localhost:3001/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auto-Backup (FTP) + Firewall Shield',
        description: 'Bloqueia ataques (mantem 8291 e Ping) e cria rotina automatica que faz backup as 03:00 e envia pro FTP do Coolify.',
        content: content
      })
    });
    console.log(await res.json());
  } catch (err) {
    console.error(err);
  }
}
addScript();
