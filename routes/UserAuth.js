import express from 'express';
import {HandleConfirmOtp,HandleSendOtp} from '../Controllers/authentication/UserAuth.js';


const router = express.Router();

router.post('/send-otp', HandleSendOtp);
router.post('/verify', HandleConfirmOtp);

export default router;