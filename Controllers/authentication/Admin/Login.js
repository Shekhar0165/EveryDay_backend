import Admin from '../../../models/Admin.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_CONFIG = {
    // eslint-disable-next-line no-undef
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    // eslint-disable-next-line no-undef
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: '1d',
    REFRESH_TOKEN_EXPIRY: '7d'
};

const generateTokens = (admin) => {
    const accessToken = jwt.sign(
        {
            id: admin._id,
            adminid: admin.adminid
        },
        JWT_CONFIG.ACCESS_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: admin._id },
        JWT_CONFIG.REFRESH_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};

const AdminAuth = async (req, res) => {
    const { adminid, password } = req.body;

    try {
        let admin = await Admin.findOne({ adminid });
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }
        const tokens = generateTokens(admin);

        // Set access token cookie
        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            domain: ".fatafat.unifhub.fun", // leading dot allows sharing across all subdomains
            path: '/',
            maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
        });

        // Set refresh token cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            domain: ".fatafat.unifhub.fun", // same here
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });


        admin.refreshToken = tokens.refreshToken;
        await admin.save();
        // Respond with success
        res.status(200).json({
            success: true,
            message: 'Admin logged in successfully',
            tokens
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}


const GenerateSuperAdmin = async (req, res) => {
    const { adminid } = req.body;
    try {
        let superAdmin = await Admin.findOne({ adminid });
        if (superAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Superadmin already exists'
            });
        }
        // eslint-disable-next-line no-undef
        if (adminid === process.env.SUPER_ADMIN_ID) {
            const password = process.env.SUPER_ADMIN_Password

            const hashedPassword = await bcrypt.hash(password, 10);
            superAdmin = new Admin({
                adminid,
                password: hashedPassword
            });

            await superAdmin.save();
            return res.status(201).json({
                success: true,
                message: 'Superadmin created successfully'
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: 'Invalid email for superadmin creation'
            });
        }
    } catch (error) {
        console.error('Error checking for existing superadmin:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}



export { AdminAuth, GenerateSuperAdmin };