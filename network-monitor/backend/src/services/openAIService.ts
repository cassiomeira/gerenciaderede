import OpenAI from 'openai';
import { monitoringService } from './monitoringService.js';

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '' // Configure via .env
    });
  }

  public async analyzeOutage(nodeIp: string): Promise<string> {
    try {
      const inventory = monitoringService.getInventory();
      const node = inventory.find((n: any) => n.ip === nodeIp);
      
      if (!node) return 'Equipamento não encontrado no inventário.';

      // Montar contexto básico para a IA
      const context = `
        O equipamento "${node.name}" (${node.ip}) ficou OFFLINE.
        O sistema de monitoramento detectou a queda e precisa de uma breve explicação do impacto e possíveis causas.
        Responda em PORTUGUÊS, de forma concisa (máximo 2-3 frases), como um engenheiro de redes sênior.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: context }],
        max_tokens: 150
      });

      return response.choices[0].message.content || 'Sem análise disponível.';
    } catch (err) {
      console.error('[OPENAI] Erro na análise:', err);
      return 'Erro ao processar análise inteligente.';
    }
  }
}

export const openAIService = new OpenAIService();
