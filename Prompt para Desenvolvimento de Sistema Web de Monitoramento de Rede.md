# Prompt para Desenvolvimento de Sistema Web de Monitoramento de Rede

## Objetivo

Desenvolver um sistema web de monitoramento de rede, inspirado no **The Dude da Mikrotik**, com foco na integração com a **API do IXC Soft** e na coleta de dados em tempo real de equipamentos wireless (Intelbras e Mikrotik). O sistema deve permitir a correlação do MAC Address de login do cliente no IXC com informações de rádio (sinal, CCQ, antena conectada), oferecendo diagnósticos e sugestões para melhoria da qualidade do serviço.

## Funcionalidades Chave

1.  **Dashboard Interativo**: Visualização gráfica da rede, com ícones representando POPs, antenas e clientes, indicando status (online/offline) e alertas.
2.  **Busca por Cliente**: Campo de busca rápido por nome de cliente, login ou MAC Address.
3.  **Detalhes do Cliente**: Ao selecionar um cliente, exibir um painel com:
    *   Informações do IXC (nome, contrato, plano, IP).
    *   Informações de rádio em tempo real (antena conectada, sinal, CCQ, data rate, uptime).
    *   Histórico de sinal e CCQ (gráficos simples).
    *   **Diagnóstico e Sugestões**: Análise automática dos dados de rádio com recomendações (ex: "Sinal baixo, verificar alinhamento", "CCQ instável, considerar troca de canal").
4.  **Gerenciamento de Antenas**: Listagem das antenas (APs) com seus IPs, quantidade de clientes conectados e status geral.

## Stack Tecnológico Sugerida

*   **Frontend**: React.js com TailwindCSS para uma interface responsiva e moderna.
*   **Backend**: Node.js (com Express.js) ou Python (com FastAPI/Flask) para a API e lógica de integração.
*   **Banco de Dados**: PostgreSQL ou MongoDB para armazenar dados históricos e configurações.
*   **Monitoramento de Rede**: Bibliotecas SNMP para Node.js (`net-snmp`) ou Python (`pysnmp`, `easysnmp`) para comunicação com os equipamentos.
*   **Gráficos**: Chart.js ou Recharts para visualização de dados históricos.

## Detalhes da Integração

### 1. Integração com a API do IXC Soft

*   **URL Base da API**: `https://SEU_DOMINIO/webservice/v1`
*   **Autenticação**: Utilizar um token de acesso gerado no IXC Soft. O token deve ser enviado no cabeçalho `Authorization: Bearer SEU_TOKEN` ou conforme a documentação específica do IXC.
*   **Endpoints Essenciais**:
    *   **`GET /radusuarios`**: Para buscar informações de login de clientes. Será necessário filtrar por `mac` ou `login`.
        *   **Parâmetros de busca**: `qtype=radusuarios.mac`, `query=MAC_DO_CLIENTE`, `oper==`.
        *   **Campos de interesse**: `id`, `login`, `mac`, `id_cliente`, `id_contrato`, `id_transmissor`, `ip`, `online`.
    *   **`GET /transmissores`**: Para obter detalhes dos transmissores (APs/OLTs).
        *   **Parâmetros de busca**: `qtype=transmissores.id`, `query=ID_DO_TRANSMISSOR`, `oper==`.
        *   **Campos de interesse**: `id`, `descricao`, `ip`, `tipo_equipamento`.
    *   **`GET /radpop`**: Para obter informações sobre os Pontos de Transmissão (POPs).
        *   **Campos de interesse**: `id`, `pop`, `endereco`, `latitude`, `longitude`.

### 2. Coleta de Dados de Rádio (SNMP/SSH)

O sistema precisará se conectar diretamente aos equipamentos wireless (Intelbras e Mikrotik) para obter dados em tempo real.

*   **Intelbras (WOM 5A, APC 5A)**:
    *   **SNMP**: É necessário obter as MIBs específicas da Intelbras para os modelos utilizados. Alguns OIDs comuns para dados wireless incluem:
        *   **Sinal (Signal Strength)**: `.1.3.6.1.4.1.29223.1.1.1.1.1.1.1.7` (exemplo, pode variar).
        *   **CCQ**: `.1.3.6.1.4.1.29223.1.1.1.1.1.1.1.17` (exemplo, pode variar).
    *   **SSH (Fallback)**: Caso o SNMP não seja suficiente ou esteja desabilitado, o sistema deve ter a capacidade de executar comandos SSH para extrair informações. Exemplo de comando para obter a tabela de registro de clientes:
        ```bash
        # Exemplo para Mikrotik, adaptar para Intelbras se disponível
        /interface wireless registration-table print detail
        ```

*   **Mikrotik (RouterOS)**:
    *   **SNMP**: Os OIDs para Mikrotik são mais padronizados:
        *   **Signal Strength (Tabela de Registro)**: `.1.3.6.1.4.1.14988.1.1.1.2.1.3` (para cada entrada na tabela de registro).
        *   **CCQ (Tabela de Registro)**: `.1.3.6.1.4.1.14988.1.1.1.2.1.10` (para cada entrada na tabela de registro).
    *   **SSH (Fallback)**: Comandos CLI para obter dados detalhados:
        ```bash
        /interface wireless registration-table print detail
        ```

### 3. Lógica de Correlação de Dados

1.  **Entrada do Usuário**: O usuário informa o MAC Address ou Login do cliente.
2.  **Consulta IXC**: O backend consulta a API do IXC (`/radusuarios`) para obter o `id_transmissor` e o `ip` do cliente associado ao MAC/Login fornecido.
3.  **Identificação do AP**: Com o `id_transmissor`, o backend consulta a API do IXC (`/transmissores`) para obter o IP do Access Point (AP) ao qual o cliente está conectado.
4.  **Coleta de Dados de Rádio**: Utilizando o IP do AP e as credenciais (SNMP Community String ou credenciais SSH), o backend realiza uma consulta SNMP ou SSH no AP.
    *   Ele busca na tabela de registro wireless do AP pelo MAC Address do cliente.
    *   Extrai o sinal (dBm), CCQ (%), data rate e uptime do link.
5.  **Exibição e Diagnóstico**: Os dados coletados são apresentados na interface do usuário. O sistema aplica regras de diagnóstico:
    *   **Sinal**: Se o sinal estiver abaixo de um limiar (ex: -70 dBm), sugere "Verificar alinhamento da antena do cliente".
    *   **CCQ**: Se o CCQ estiver abaixo de um limiar (ex: 80%), sugere "Verificar interferência, ruído ou canal".
    *   Outras sugestões podem incluir "Verificar cabeamento", "Reiniciar equipamento", etc.

## Arquitetura do Sistema

*   **Frontend (React)**: Consome a API do backend para exibir os dados.
*   **Backend (Node.js/Python)**:
    *   Expõe uma API RESTful para o frontend.
    *   Gerencia a autenticação com a API do IXC.
    *   Realiza as chamadas para a API do IXC.
    *   Gerencia as conexões SNMP/SSH com os equipamentos de rede.
    *   Processa e correlaciona os dados antes de enviá-los ao frontend.
    *   Pode implementar um sistema de cache para dados do IXC que não mudam frequentemente.
*   **Serviço de Coleta (Worker)**: Um processo em segundo plano (ou um serviço separado) que periodicamente coleta dados SNMP/SSH dos APs e armazena no banco de dados para histórico e alertas.

## Considerações de Escalabilidade e Performance

*   **Coleta Assíncrona**: A coleta de dados SNMP/SSH deve ser assíncrona para não bloquear a API do backend.
*   **Cache**: Implementar cache para dados da API do IXC que não mudam em tempo real (ex: lista de clientes, transmissores).
*   **Banco de Dados de Séries Temporais**: Para o histórico de sinal e CCQ, considerar um banco de dados otimizado para séries temporais (ex: InfluxDB) se o volume de dados for muito grande.

## Requisitos de Segurança

*   Armazenar credenciais da API do IXC e dos equipamentos de rede de forma segura (variáveis de ambiente, HashiCorp Vault, etc.).
*   Implementar HTTPS para toda a comunicação web.
*   Validar e sanitizar todas as entradas do usuário.

## Passos Iniciais para o Desenvolvimento (para o Cursor/Antigravity)

1.  **Configuração do Ambiente**: Configurar um projeto React/Node.js ou React/Python.
2.  **Integração IXC**: Implementar a autenticação e as chamadas básicas para os endpoints `radusuarios` e `transmissores`.
3.  **Teste SNMP/SSH**: Desenvolver um módulo para testar a conexão SNMP/SSH com um equipamento de rede de exemplo e extrair OIDs de sinal e CCQ.
4.  **Estrutura do Banco de Dados**: Definir o esquema do banco de dados para clientes, antenas e dados históricos de monitoramento.
5.  **Desenvolvimento do Frontend**: Criar a estrutura básica do dashboard e da tela de detalhes do cliente.

Este prompt fornece uma base sólida para o desenvolvimento do sistema. O Cursor/Antigravity deve ser capaz de preencher os detalhes de implementação e escolher as bibliotecas e frameworks mais adequados dentro da stack sugerida.
