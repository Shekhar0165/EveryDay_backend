import express from 'express';
import {HandleConfirmOtp,HandleSendOtp,HandleRefreshToken} from '../Controllers/authentication/UserAuth.js';


const router = express.Router();

router.post('/send-otp', HandleSendOtp);
router.post('/verify', HandleConfirmOtp);
router.post('/refresh-token', HandleRefreshToken);

export default router;