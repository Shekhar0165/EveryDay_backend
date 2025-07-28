import express from 'express';
import { handleGetLabels,addLabel } from '../../Controllers/application/Label.js'
import { AdminAuth } from '../../middleware/AdminAuth.js';


const router = express.Router();

router.get('/labels', handleGetLabels);
router.post('/labels/add', addLabel);

export default router;
