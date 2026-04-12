import { Router } from 'express';
import {
  getNE8000Dashboard,
  getNE8000Interfaces,
  getNE8000InterfaceTraffic,
  getNE8000BgpPeers,
  getNE8000System,
  getNE8000Pppoe,
  getNE8000Vlans,
  getNE8000MainPorts,
} from '../controllers/ne8000Controller.js';

const router = Router();

router.get('/dashboard', getNE8000Dashboard);
router.get('/interfaces', getNE8000Interfaces);
router.get('/interfaces/:name/traffic', getNE8000InterfaceTraffic);
router.get('/bgp', getNE8000BgpPeers);
router.get('/system', getNE8000System);
router.get('/pppoe', getNE8000Pppoe);
router.get('/vlans', getNE8000Vlans);
router.get('/ports', getNE8000MainPorts);

export default router;
