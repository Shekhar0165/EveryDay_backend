

import express from "express";
import {
    HandleSaveUserLocation,
    HandlePreviewUserLocation,
    HandleGetUserProfile,
    HandleCheckWeAreThere,
    updateUserProfile
} from "../../Controllers/application/User.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.post('/location/preview', auth, HandlePreviewUserLocation);
router.post('/location', auth, HandleSaveUserLocation);
router.get('/location/get', auth, HandleGetUserProfile);
router.post('/location/check', auth, HandleCheckWeAreThere);
router.put('/update/profile', auth, updateUserProfile);

export default router;




