import express from "express";
import {
    HandlePlaceOrder,
    HandleCreateRazorpayOrder
} from "../../Controllers/application/BuyProduct.js";
import auth from "../../middleware/auth.js";


const router = express.Router();

router.post("/place",auth, HandlePlaceOrder);
router.post('/create-razorpay-order', auth, HandleCreateRazorpayOrder);
export default router;
