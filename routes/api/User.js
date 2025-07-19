

import express from "express";
import {
    HandleSaveUserLocation,
    HandlePreviewUserLocation,
    HandleGetUserLocation
} from "../../Controllers/application/User.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.post('/location/preview', auth, HandlePreviewUserLocation);
router.post('/location', auth, HandleSaveUserLocation);
router.get('/location/get', auth, HandleGetUserLocation);

export default router;




