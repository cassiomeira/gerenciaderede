const content = `# =========================================================================
# SCRIPT UNIFICADO: MONITORAMENTO + FIREWALL + AUTO-BACKUP FTP
# =========================================================================

# 1. Ativar Servicos Essenciais nas portas padrao (Garante acesso ao sistema)
/ip service
set winbox port=8291 disabled=no
set ssh port=22 disabled=no
set api port=8728 disabled=no

# 2. Ativar SNMP (Garante que a Telemetria do Monitoramento vai funcionar)
/snmp set enabled=yes trap-version=2
/snmp community set [find default=yes] name=public read-access=yes

# 3. Protecao de Firewall
/ip firewall filter
# Libera acesso total para o Servidor de Monitoramento local
add action=accept chain=input comment=\"Permitir Servidor Monitoramento\" src-address=192.168.13.230
# Libera Winbox e Ping geral
add action=accept chain=input comment=\"Allow Winbox\" dst-port=8291 protocol=tcp
add action=accept chain=input comment=\"Allow Ping\" protocol=icmp
# Derruba conexoes invalidas ou tentativas de Scanner
add action=drop chain=input comment=\"Drop Invalid connections\" connection-state=invalid

# 4. Rotina de Auto-Backup FTP
/system script remove [find name=\"auto_backup_ftp\"]
/system script add name=\"auto_backup_ftp\" source=\":local routerName [/system identity get name]; :local date [/system clock get date]; :local fixedDate [:pick \\$date 0 3][:pick \\$date 4 6][:pick \\$date 7 11]; :local filename (\\$routerName . \\\"-\\\" . \\$fixedDate); /system backup save name=\\$filename; /export show-sensitive file=\\$filename; :delay 5s; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\\".backup\\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\\".backup\\\") upload=yes; /tool fetch address=217.216.86.231 port=21 src-path=(\\$filename . \\\".rsc\\\") user=mikrotik password=backup_spn mode=ftp dst-path=(\\$filename . \\\".rsc\\\") upload=yes; :delay 5s; /file remove [find name=(\\$filename . \\\".backup\\\")]; /file remove [find name=(\\$filename . \\\".rsc\\\")];\"

# 5. Agendador para rodar as 03:00 da manha
/system scheduler remove [find name=\"schedule_backup_ftp\"]
/system scheduler add name=\"schedule_backup_ftp\" interval=1d start-time=03:00:00 on-event=\"auto_backup_ftp\"
`;

async function updateScripts() {
  try {
    // 1. Deletar o script antigo criado anteriormente (ID c4fda44e-f86e-498e-b0da-3c1acaa30aeb)
    await fetch('http://localhost:3001/api/scripts/c4fda44e-f86e-498e-b0da-3c1acaa30aeb', { method: 'DELETE' });

    // 2. Criar o script definitivo
    const res = await fetch('http://localhost:3001/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mestre: Preparacao, Firewall e Auto-Backup',
        description: 'Forca ativacao segura do SSH/Winbox/SNMP, libera acesso do servidor e cria Backup FTP diario as 03:00.',
        content: content
      })
    });
    console.log(await res.json());
  } catch (err) {
    console.error(err);
  }
}
updateScripts();
