

import express from "express";
import {
    HandleSaveUserLocation,
    HandlePreviewUserLocation
} from "../../Controllers/application/User.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.post('/location/preview', auth, HandlePreviewUserLocation);
router.post('/location', auth, HandleSaveUserLocation);

export default router;




