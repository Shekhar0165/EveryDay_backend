import express from 'express';
import { HandleAddToCard ,HandleGetOrder,HandleGetOneOrderFromId,HandleGetOrderForUser} from '../../Controllers/application/Order.js'
import auth from '../../middleware/auth.js';


const router = express.Router();

router.get('/add-to-card', HandleAddToCard);
router.get('/admin/get', HandleGetOrder);
router.get('/get/one/:OrderId', HandleGetOneOrderFromId);
router.get('/list',auth, HandleGetOrderForUser);

export default router;
