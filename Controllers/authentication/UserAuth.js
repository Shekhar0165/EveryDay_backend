import User from '../../models/User.js';
import jwt from 'jsonwebtoken';

const JWT_CONFIG = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: '1d',
    REFRESH_TOKEN_EXPIRY: '7d'
};

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user._id },
        JWT_CONFIG.ACCESS_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        JWT_CONFIG.REFRESH_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

const SendOtpToNumber = async (otp, number) => {
    try {
        console.log({ otp, number });
    } catch (error) {
        console.error('Failed to send OTP:', error);
    }
};

const HandleSendOtp = async (req, res) => {
    const { mobile } = req.body;
    console.log(mobile)
    if (!mobile) {
        return res.status(400).send({ success: false, message: 'Mobile number required' });
    }

    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

        let user = await User.findOne({ mobile });

        if (!user) {
            user = new User({
                mobile,
                isVerified: false,
                otp,
                otpExpiresAt: expiry
            });
        } else {
            user.otp = otp;
            user.otpExpiresAt = expiry;
        }

        await user.save();
        await SendOtpToNumber(otp, mobile);

        res.status(200).send({ success: true, message: `OTP sent to ${mobile}` });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Internal Server Error', error });
    }
};

const HandleConfirmOtp = async (req, res) => {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
        return res.status(400).send({ success: false, message: 'Mobile and OTP required' });
    }

    try {
        const user = await User.findOne({ mobile }).select('+otp +otpExpiresAt');

        if (!user) {
            return res.status(404).send({ success: false, message: 'User not found' });
        }

        if (!user.otp || !user.otpExpiresAt || Date.now() > user.otpExpiresAt.getTime()) {
            return res.status(400).send({ success: false, message: 'OTP expired. Please request again.' });
        }

        if (user.otp !== otp) {
            return res.status(400).send({ success: false, message: 'Invalid OTP' });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpiresAt = null;

        const tokens = generateTokens(user);
        user.refreshToken = tokens.refreshToken;

        res.cookie('accessToken', tokens.accessToken, {
            sameSite: 'Lax',
            path: '/',
            maxAge: 1 * 24 * 60 * 60 * 1000,
        });

        // Refresh Token Cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        await user.save();



        res.status(200).send({
            success: true,
            message: 'OTP verified successfully',
            tokens: tokens,
        });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Internal Server Error', error });
    }
};

export { HandleSendOtp, HandleConfirmOtp };
