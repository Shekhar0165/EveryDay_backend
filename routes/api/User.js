

import express from "express";
import {
    HandleSaveUserLocation,
    HandlePreviewUserLocation,
    HandleGetUserProfile,
    HandleCheckWeAreThere,
    updateUserProfile,
    checkUser,
    sendVerification,
    verifyAndDelete
} from "../../Controllers/application/User.js";
import auth from "../../middleware/auth.js";

const router = express.Router();

router.post('/location/preview', auth, HandlePreviewUserLocation);
router.post('/location', auth, HandleSaveUserLocation);
router.get('/location/get', auth, HandleGetUserProfile);
router.post('/location/check', auth, HandleCheckWeAreThere);
router.put('/update/profile', auth, updateUserProfile);


router.post('/check-user', checkUser);
router.post('/send-verification', sendVerification);
router.post('/delete-account', verifyAndDelete);

export default router;




