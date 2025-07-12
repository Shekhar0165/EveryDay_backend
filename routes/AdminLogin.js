import express from 'express';
import {GenerateSuperAdmin,AdminAuth} from '../Controllers/authentication/Admin/Login.js';


const router = express.Router();

router.post('/auth/admin', GenerateSuperAdmin);
router.post('/admin', AdminAuth);

export default router;