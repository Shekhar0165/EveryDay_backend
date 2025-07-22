import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const JWT_CONFIG = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: '1d',
    REFRESH_TOKEN_EXPIRY: '7d'
};

export const AdminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const accessToken = authHeader && authHeader.split(' ')[1];

        console.log('Access Token:', accessToken);


        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        try {
            const decoded = jwt.verify(accessToken, JWT_CONFIG.ACCESS_TOKEN_SECRET);
            const admin = await Admin.findById(decoded.id);
            req.admin = admin;
            next();
        } catch (error) {
            console.log(error);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired access token'
            });
        }
    } catch (error) {
        console.error('Error in verifyToken middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};



