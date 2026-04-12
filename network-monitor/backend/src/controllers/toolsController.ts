import { Request, Response } from 'express';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

// ─── Continuous Ping via SSE ──────────────────────────────────────────────────
export const pingContinuous = (req: Request, res: Response) => {
  const ip = req.params.ip as string;
  if (!ip) { res.status(400).json({ error: 'IP required' }); return; }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Start ping -t (continuous) on Windows
  const ping = spawn('ping', ['-t', ip], { windowsHide: true }) as ChildProcessWithoutNullStreams;

  const sendLine = (line: string) => {
    if (line.trim()) {
      res.write(`data: ${JSON.stringify({ line: line.trim(), time: new Date().toISOString() })}\n\n`);
    }
  };

  ping.stdout.on('data', (data: Buffer) => {
    const text = data.toString('utf-8');
    text.split('\n').forEach(sendLine);
  });

  ping.stderr.on('data', (data: Buffer) => {
    const text = data.toString('utf-8');
    text.split('\n').forEach(sendLine);
  });

  ping.on('close', (code: any) => {
    res.write(`data: ${JSON.stringify({ line: `--- Ping finalizado (code ${code}) ---`, time: new Date().toISOString(), done: true })}\n\n`);
    res.end();
  });

  // Clean up when client disconnects
  req.on('close', () => {
    ping.kill();
  });
};

// ─── Launch Winbox ────────────────────────────────────────────────────────────
export const launchWinbox = (req: Request, res: Response) => {
  const ip = req.params.ip as string;
  if (!ip) { res.status(400).json({ error: 'IP required' }); return; }

  const winboxPath = 'C:\\Tools\\winbox.exe';

  try {
    // Launch winbox detached so it runs independently
    const child = spawn(winboxPath, [ip], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    res.json({ success: true, message: `Winbox aberto para ${ip}` });
  } catch (err: any) {
    res.status(500).json({ error: `Falha ao abrir Winbox: ${err.message}` });
  }
};

// ─── Traceroute ───────────────────────────────────────────────────────────────
export const traceroute = (req: Request, res: Response) => {
  const ip = req.params.ip as string;
  if (!ip) { res.status(400).json({ error: 'IP required' }); return; }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const tracert = spawn('tracert', ['-d', ip], { windowsHide: true }) as ChildProcessWithoutNullStreams;

  const sendLine = (line: string) => {
    if (line.trim()) {
      res.write(`data: ${JSON.stringify({ line: line.trim(), time: new Date().toISOString() })}\n\n`);
    }
  };

  tracert.stdout.on('data', (data: Buffer) => {
    data.toString('utf-8').split('\n').forEach(sendLine);
  });

  tracert.stderr.on('data', (data: Buffer) => {
    data.toString('utf-8').split('\n').forEach(sendLine);
  });

  tracert.on('close', (code: any) => {
    res.write(`data: ${JSON.stringify({ line: `--- Traceroute finalizado ---`, time: new Date().toISOString(), done: true })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    tracert.kill();
  });
};
