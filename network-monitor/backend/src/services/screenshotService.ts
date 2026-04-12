import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

class ScreenshotService {
  private browser: any = null;

  private async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--ignore-certificate-errors',
          '--disable-dev-shm-usage'
        ],
        headless: true
      });
    }
    return this.browser;
  }

  public async captureNode(mapId: string, nodeIp: string): Promise<string | null> {
    return this.takeScreenshot(mapId, nodeIp);
  }

  public async captureFullMap(mapId: string, offlineNodes?: string): Promise<string | null> {
    return this.takeScreenshot(mapId, undefined, offlineNodes);
  }

  private async takeScreenshot(mapId: string, nodeIp?: string, offlineNodes?: string): Promise<string | null> {
    let page = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      
      // Simula um monitor Full HD, mas o deviceScaleFactor=2 renderiza na prática em 4K (alta densidade)
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
      
      // Capturar logs do console do navegador para o terminal do backend
      page.on('console', (msg: any) => console.log('[PUPPETEER CONSOLE]', msg.text()));
      page.on('pageerror', (err: any) => console.error('[PUPPETEER ERROR]', err.message));
      page.on('requestfailed', (request: any) => console.error('[PUPPETEER REQ FAIL]', request.url(), request.failure()?.errorText));

      // Adicionar cabeçalho de bypass para as chamadas de API feitas pela página
      await page.setExtraHTTPHeaders({
        'x-internal-secret': 'NETMONITOR_INTERNAL_BYPASS_2026'
      });
      
      let baseUrl = `http://127.0.0.1:5173/screenshot-map/${mapId}?export=true&secret=NETMONITOR_INTERNAL_BYPASS_2026`;
      if (nodeIp) baseUrl += `&highlight=${nodeIp}`;
      if (offlineNodes) baseUrl += `&offline=${offlineNodes}`;
      const url = baseUrl;
      
      console.log(`[SCREENSHOT] Capturando com Bypass: ${url}`);
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
      } catch (e) {
        console.warn('[SCREENSHOT] Timeout no networkidle2, prosseguindo com waitUntil:load...');
        await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      }
      
      // ESPERA ATÉ QUE O FRONTEND SINALIZE QUE OS DADOS CARREGARAM
      console.log('[SCREENSHOT] Aguardando sinalizador #screenshot-ready...');
      try {
        await page.waitForSelector('#screenshot-ready', { timeout: 25000 });
        console.log('[SCREENSHOT] Mapa carregado com sucesso!');
      } catch (e) {
        console.error('[SCREENSHOT] AVISO: Sinalizador #screenshot-ready não apareceu! Tirando foto mesmo assim...');
      }
      
      // Pequena pausa extra para o Canvas terminar o primeiro frame de renderização
      await new Promise(resolve => setTimeout(resolve, 3000));

      const screenshotPath = path.resolve(`./temp_screenshot_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      return screenshotPath;
    } catch (err) {
      console.error('[SCREENSHOT] Erro na captura:', err);
      return null;
    } finally {
      if (page) await page.close();
    }
  }

  public async cleanUp(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('[SCREENSHOT] Erro ao deletar temporário:', err);
    }
  }
}

export const screenshotService = new ScreenshotService();
