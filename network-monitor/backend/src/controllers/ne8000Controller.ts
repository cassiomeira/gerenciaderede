import { Request, Response } from 'express';
import { ne8000Service } from '../services/ne8000Service.js';

export function getNE8000Dashboard(_req: Request, res: Response) {
  res.json(ne8000Service.getDashboard());
}

export function getNE8000Interfaces(_req: Request, res: Response) {
  res.json(ne8000Service.getInterfaces());
}

export function getNE8000InterfaceTraffic(req: Request, res: Response) {
  const name = decodeURIComponent(req.params.name);
  const hours = parseInt(req.query.hours as string) || 2;
  res.json(ne8000Service.getInterfaceTraffic(name, hours));
}

export function getNE8000BgpPeers(_req: Request, res: Response) {
  res.json(ne8000Service.getBgpPeers());
}

export function getNE8000System(_req: Request, res: Response) {
  res.json(ne8000Service.getSystem());
}

export function getNE8000Pppoe(_req: Request, res: Response) {
  res.json(ne8000Service.getPppoe());
}

export function getNE8000Vlans(_req: Request, res: Response) {
  res.json(ne8000Service.getBridgeDomains());
}

export function getNE8000MainPorts(_req: Request, res: Response) {
  res.json(ne8000Service.getMainPorts());
}
