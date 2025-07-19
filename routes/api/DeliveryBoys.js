import express from "express";
import {
    HandleAddDeliveryBoys,
    verifyDeliveryBoyEmail,
    HandleGetDeliveryBoys,
    HandleGetDeliveryBoyProfile,
    HandleChangeStatusOnline,
    HandleAssignDeliveryBoys,
    HandleCheckDeliveryPending,
    HandleCompleteOrder,
    HandleGetOrderByDeliveryId
} from "../../Controllers/application/DeliveryBoy.js";
import { AdminAuth } from "../../middleware/AdminAuth.js"; 
import { HandleLoginDeliveryBoy } from "../../Controllers/authentication/DeliveryBoyLogin.js";
import DeliveryBoyAuth from "../../middleware/DeliveryBoysAuth.js";

const router = express.Router();

router.post("/add",  HandleAddDeliveryBoys);
router.post("/verify", verifyDeliveryBoyEmail);
router.get("/get",AdminAuth, HandleGetDeliveryBoys);
router.get("/profile",DeliveryBoyAuth , HandleGetDeliveryBoyProfile);
router.post("/set/isonline" ,DeliveryBoyAuth, HandleChangeStatusOnline);
router.post("/assign/:orderId" ,DeliveryBoyAuth, HandleAssignDeliveryBoys);
router.get("/check-panding-order" ,DeliveryBoyAuth, HandleCheckDeliveryPending);
router.post("/complete-order" ,DeliveryBoyAuth, HandleCompleteOrder);
router.get("/get-orders" ,DeliveryBoyAuth, HandleGetOrderByDeliveryId);

// auth
router.post('/login', HandleLoginDeliveryBoy);
export default router;
