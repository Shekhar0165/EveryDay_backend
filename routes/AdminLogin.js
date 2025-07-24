import express from 'express';
import {GenerateSuperAdmin,AdminAuth,HandleAddCoordinates} from '../Controllers/authentication/Admin/Login.js';


const router = express.Router();

router.post('/auth/admin', GenerateSuperAdmin);
router.post('/admin', AdminAuth);
router.post('/admin/coordinates', HandleAddCoordinates);

export default router;