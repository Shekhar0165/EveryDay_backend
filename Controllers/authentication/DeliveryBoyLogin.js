import DeliveryBoy from '../../models/DeliveryBoy.js';
import jwt from 'jsonwebtoken';

const JWT_CONFIG = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY: '1d',
    REFRESH_TOKEN_EXPIRY: '7d'
};

const generateTokens = (boy) => {
    const accessToken = jwt.sign(
        { id: boy._id },
        JWT_CONFIG.ACCESS_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { id: boy._id },
        JWT_CONFIG.REFRESH_TOKEN_SECRET,
        { expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
};



const HandleLoginDeliveryBoy = async (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).send({ success: false, message: 'Mobile and password required' });
    }

    try {
        const boy = await DeliveryBoy.findOne({ mobile });

        if (!boy) {
            return res.status(404).send({ success: false, message: 'DeliveryBoy not found' });
        }

        const tokens = generateTokens(boy);
        boy.refreshToken = tokens.refreshToken;

        await boy.save();
        res.status(200).send({
            success: true,
            message: 'Login successfully',
            tokens: tokens,
        });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Internal Server Error', error });
    }
};

export { HandleLoginDeliveryBoy };
