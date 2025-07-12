import express from 'express';
import { HandleAddToCard } from '../../Controllers/application/Order.js'
import { AdminAuth } from '../../middleware/AdminAuth.js';


const router = express.Router();

router.get('/add-to-card', HandleAddToCard);

export default router;
