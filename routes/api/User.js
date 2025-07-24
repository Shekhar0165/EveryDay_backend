

import express from "express";
import {
    HandleSaveUserLocation,
    HandlePreviewUserLocation,
    HandleGetUserLocation,
    HandleCheckWeAreThere
} from "../../Controllers/application/User.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.post('/location/preview', auth, HandlePreviewUserLocation);
router.post('/location', auth, HandleSaveUserLocation);
router.get('/location/get', auth, HandleGetUserLocation);
router.post('/location/check', auth, HandleCheckWeAreThere);

export default router;




