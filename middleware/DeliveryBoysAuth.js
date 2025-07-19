import jwt from 'jsonwebtoken';
import DeliveryBoy from '../models/DeliveryBoy.js';

const DeliveryBoyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];



    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    // Check if user still exists
    const boy = await DeliveryBoy.findById(decoded.id);
    if (!boy) {
      return res.status(401).json({ 
        message: 'User not found' 
      });
    }
    req.Deliveryboy = boy
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ 
      message: 'Invalid or expired token' 
    });
  }
};


export const getBoyDataFromToken = async (token) => {
  if (!token) {
    throw new Error('Access token required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }

  const boy = await DeliveryBoy.findById(decoded.id);
  if (!boy) {
    throw new Error('User not found');
  }

  return boy;
};

export default DeliveryBoyAuth;