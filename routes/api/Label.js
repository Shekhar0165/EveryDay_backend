import express from 'express';
import { handleGetLabels } from '../../Controllers/application/Label.js'
import { AdminAuth } from '../../middleware/AdminAuth.js';


const router = express.Router();

router.get('/labels', handleGetLabels);

export default router;
