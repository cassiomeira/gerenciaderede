import { Router } from 'express';
import { login, getMe, listCompanies, createCompany, updateCompany, listUsers, createUser, deleteUser, setup, checkSetup } from '../controllers/authController.js';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware.js';

const router = Router();

// ─── Públicas ───────────────────────────────────────────────────────────
router.post('/login', login);
router.get('/check-setup', checkSetup);
router.post('/setup', setup);

// ─── Protegidas ─────────────────────────────────────────────────────────
router.get('/me', authMiddleware, getMe);

// ─── Admin ──────────────────────────────────────────────────────────────
router.get('/companies', authMiddleware, adminOnly, listCompanies);
router.post('/companies', authMiddleware, adminOnly, createCompany);
router.put('/companies/:id', authMiddleware, adminOnly, updateCompany);
router.get('/companies/:companyId/users', authMiddleware, adminOnly, listUsers);
router.post('/companies/:companyId/users', authMiddleware, adminOnly, createUser);
router.delete('/companies/:companyId/users/:userId', authMiddleware, adminOnly, deleteUser);

export default router;
