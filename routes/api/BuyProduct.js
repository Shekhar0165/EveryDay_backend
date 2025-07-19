import express from "express";
import {
    HandlePlaceOrder
} from "../../Controllers/application/BuyProduct.js";
import auth from "../../middleware/auth.js";


const router = express.Router();

router.post("/place",auth, HandlePlaceOrder);

export default router;
