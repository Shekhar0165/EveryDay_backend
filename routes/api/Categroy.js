import express from "express";
import {
    HandleGetAllCetagroy,
    HandleAddCetagroy,
    HandleDeleteCetagroy,
    HandleUpdateCetagroy,
} from "../../Controllers/application/Category.js";
import { AdminAuth } from "../../middleware/AdminAuth.js"; 

const router = express.Router();

router.get("/", HandleGetAllCetagroy);
router.post("/add", AdminAuth, HandleAddCetagroy);
router.delete("/delete/:id", AdminAuth, HandleDeleteCetagroy);
router.put("/update/:id", AdminAuth, HandleUpdateCetagroy);

export default router;
