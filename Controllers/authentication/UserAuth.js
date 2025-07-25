import User from '../../models/User.js';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import puppeteer from 'puppeteer';

const { Client, LocalAuth } = pkg;
const JWT_CONFIG = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: '120m',
    REFRESH_TOKEN_EXPIRY: '7d'
};



const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
    }),
    puppeteer: {
        headless: true, // set to false for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: puppeteer.executablePath(),
    },
});

client.on('qr', (qr) => {
    console.log('📱 Scan this QR code to login:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp is connected and ready to send messages!');
});

client.initialize();

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

        if (!number.startsWith('+91')) {
            throw new Error('Only Indian numbers (+91) are supported');
        }

        const chatId = number.replace('+', '') + '@c.us';

        const message = `Your Valon verification code is: ${otp}. This code will expire in 5 minutes. Do not share this code with anyone.`;

         const sentMessage = await client.sendMessage(chatId, message);

        console.log('OTP sent successfully via WhatsApp:', sentMessage.id.id);

        return {
            success: true,
            message: 'OTP sent successfully via WhatsApp',
            messageId: sentMessage.id.id
        };
    } catch (error) {
        console.error('Failed to send OTP via WhatsApp:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

const HandleSendOtp = async (req, res) => {
    const { mobile } = req.body;
    
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
        
        // Add +91 prefix for Twilio
        const formattedNumber = `+91${mobile}`;
        console.log('Sending OTP to formatted number:', formattedNumber);
        
        const smsResult = await SendOtpToNumber(otp, formattedNumber);
        
        if (!smsResult.success) {
            return res.status(500).send({ 
                success: false, 
                message: 'Failed to send OTP', 
                error: smsResult.error 
            });
        }

        res.status(200).send({ success: true, message: `OTP sent to ${mobile}` });
    } catch (error) {
        console.error('HandleSendOtp error:', error);
        res.status(500).send({ success: false, message: 'Internal Server Error', error: error.message });
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
            maxAge: 60 * 1000 * 60,
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


const HandleRefreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  console.log('Refresh token received:', refreshToken);

  if (!refreshToken) {
    return res.status(401).json({ 
      message: 'Refresh token required' 
    });
  }

  try {
    const user = await User.findOne({refreshToken}).select('+refreshToken');

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid refresh token' 
      });
    }

    const tokens = generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    res.json({
      success: true,
      tokens: tokens,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(403).json({ 
      message: 'Invalid or expired refresh token' 
    });
  }
};

export { HandleSendOtp, HandleConfirmOtp,HandleRefreshToken };
