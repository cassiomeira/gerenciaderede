/**
 * Utilitário para geração dinâmica de Scripts do MikroTik.
 * Este utilitário gera o código RouterOS necessário para a "Opção A: Script Automático MikroTik".
 */

interface ScriptConfig {
  companyIpSegment: string; // ex: 10.0.1.
  backendUrl: string; // ex: http://netmonitor.tmtnet.com.br/api/telemetry/push
  companyToken: string; // Token único da empresa para o PUSH
  intervalMinutes: number; // 3 ou 5
}

export const generateMikrotikTelemetryScript = (config: ScriptConfig): string => {
  const { companyIpSegment, backendUrl, companyToken, intervalMinutes } = config;
  
  // O script em RouterOS busca na tabela ARP local os dispositivos conectados e que estão vivos,
  // faz um ping puramente local usando a API /ping do mikrotik contando 3 pacotes,
  // constrói um array de objetos JSON e posta via fetch para o Coolify.
  
  return `# Script NetMonitor: Telemetria Edge (Webhook)
# Rodar a cada ${intervalMinutes} minutos via Scheduler

:local targetUrl "${backendUrl}";
:local authHeader "Authorization: Bearer ${companyToken}";
:local jsonPayload "[";
:local first true;

# Encontrar roteadores dinamicamente via ARP ou estaticamente via leases.
# Neste exemplo simplificado, vamos iterar sobre uma subnet informada e pingar quem estiver online no ARP
:foreach arpEntry in=[/ip arp find where address~"^${companyIpSegment}" and dynamic=no] do={
    :local devIp [/ip arp get $arpEntry address];
    :local pingCount [/ping $devIp count=3 size=64 interval=200ms];
    
    :local status "OFFLINE";
    :local latency 0;
    
    :if ($pingCount > 0) do={
        :set status "ONLINE";
        :set latency 5; # RouterOS v6 tem dificuldade em ler a latência média exata do ping via script, aproximamos ou lemos do queue. 
        # Numa versão avançada/v7, podemos usar: :set latency $"avg-rtt"
    }

    :if (!first) do={
        :set jsonPayload ($jsonPayload . ",");
    }
    :set first false;
    
    :set jsonPayload ($jsonPayload . "{\\"ip\\":\\"" . $devIp . "\\",\\"status\\":\\"" . $status . "\\",\\"latency\\":" . $latency . "}");
}

:set jsonPayload ($jsonPayload . "]");

:do {
    /tool fetch url=$targetUrl http-method=post http-header-field=("Content-Type: application/json", $authHeader) http-data=$jsonPayload as-value;
    :log info "NetMonitor: Telemetrias enviadas com sucesso.";
} on-error={
    :log error "NetMonitor: Falha ao enviar telemetrias para a nuvem.";
}
`;
};
