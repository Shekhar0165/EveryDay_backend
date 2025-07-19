import DeliveryBoy from '../../models/DeliveryBoy.js';
import Admin from '../../models/Admin.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import cron from 'node-cron';
import Orders from '../../models/Order.js';
import { HandleAfterAssignDeliveryBoys } from './Socket.js';





const otpStore = {};


const HandleAddDeliveryBoys = async (req, res) => {
    try {
        const { name, email, mobile } = req.body;



        // Check if already exists
        const existing = await DeliveryBoy.findOne({ email, mobile });
        if (existing) {
            return res.status(400).json({ message: 'Delivery boy already exists' });
        }

        // Generate password
        const password = crypto.randomBytes(4).toString('hex');

        // Get shop ID
        const shop = await Admin.findOne();
        if (!shop) return res.status(404).json({ message: 'Shop not found' });

        // Save to DB
        const deliveryBoy = new DeliveryBoy({
            name,
            email,
            mobile,
            password,
            Shop: shop._id
        });

        await deliveryBoy.save();

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        otpStore[email] = { otp, password, mobile };

        // Send OTP email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const mailOptions = {
            from: 'EveryDay@gmail.com',
            to: email,
            subject: 'Email Verification OTP',
            text: `Hello ${name},\n\nYour OTP for email verification is: ${otp}\n\nThanks!`
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'OTP sent to email for verification.' });

    } catch (error) {
        return res.status(500).json({ message: 'Server error', error });
    }
};



const verifyDeliveryBoyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const stored = otpStore[email];
        if (!stored) {
            return res.status(400).json({ message: 'OTP not found. Try again.' });
        }

        if (stored.otp != otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Mark as verified
        await DeliveryBoy.findOneAndUpdate({ email }, { isVerified: true });

        // Send welcome email with ID and password
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        const welcomeOptions = {
            from: 'your-email@gmail.com',
            to: email,
            subject: 'Welcome! Your Delivery Boy Login Details',
            text: `Welcome aboard!\n\nYour login credentials are:\nID: ${stored.mobile}\nPassword: ${stored.password}\n\nPlease keep them safe.`
        };

        await transporter.sendMail(welcomeOptions);

        // Clean up OTP
        delete otpStore[email];

        return res.status(200).json({ message: 'Email verified successfully. Credentials sent.' });

    } catch (error) {
        console.error('Error in verifyDeliveryBoyEmail:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};


const HandleGetDeliveryBoys = async (req, res) => {
    // const ShopId = req.admin._id;
    // console.log(ShopId)

    try {
        const deliveryBoys = await DeliveryBoy.find({ Shop: '686a6e62d929988bced13abd', isVerified: true });

        if (deliveryBoys.length === 0) {
            return res.status(404).json({ message: 'No delivery boys found for this shop.' });
        }

        return res.status(200).json({
            message: 'Delivery boys fetched successfully.',
            deliveryBoys
        });
    } catch (error) {
        console.error('Error fetching delivery boys:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};


const HandleGetDeliveryBoyProfile = async (req, res) => {
    const BoyId = req.Deliveryboy._id;
    try {
        const boy = await DeliveryBoy.find({ _id: BoyId, isVerified: true });
        if (!boy) {
            return res.status(404).json({ message: "Delivery Boys Not Found" });
        }

        return res.status(200).json({
            message: 'Delivery boy Profile fetched successfully.',
            boy: boy[0]
        })

    } catch (error) {
        console.error('Error fetching delivery boys:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
}

const HandleChangeStatusOnline = async (req, res) => {
    try {
        const { mobile, shop } = req.body;
        const { _id } = req.Deliveryboy

        if (!mobile || !shop) {
            return res.status(400).json({ message: 'Missing required fields', success: false });
        }

        // Find the delivery boy
        const deliveryBoy = await DeliveryBoy.findOne({ _id, mobile, Shop: shop });

        if (!deliveryBoy) {
            return res.status(404).json({ message: 'Delivery boy not found', success: false });
        }

        const now = new Date();
        const onlineUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now

        // Update status
        if (deliveryBoy.isOnline) {
            deliveryBoy.isOnline = false;
            deliveryBoy.onlineUntil = null;
        }
        else {
            deliveryBoy.isOnline = true;
            deliveryBoy.onlineUntil = onlineUntil;
        }

        await deliveryBoy.save();

        res.status(200).json({
            message: 'Status updated to online for 6 hours',
            success: true,
            onlineUntil
        });

    } catch (error) {
        console.error('Error changing status:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};



const HandleAssignDeliveryBoys = async (req, res) => {
    try {
        const { orderId } = req.params;
        const deliveryBoyId = req.Deliveryboy?._id;

        if (!orderId || !deliveryBoyId) {
            return res.status(400).json({ message: 'Missing orderId or deliveryBoyId' });
        }

        const [order, deliveryBoy] = await Promise.all([
            Orders.findById(orderId)
                .populate('OrderBy', 'name email phone address')
                .populate('DeliveryBy')
                .populate('Product.ProductId'),
            DeliveryBoy.findById(deliveryBoyId)
        ]);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!deliveryBoy) {
            return res.status(404).json({ message: 'Delivery boy not found' });
        }

        // ✅ Prevent assigning if delivery boy already has a delivery
        if (deliveryBoy.OnDelivery !== null) {
            return res.status(400).json({
                success: false,
                message: 'You already have a delivery assigned. Complete it before taking another.',
                currentDelivery: deliveryBoy.OnDelivery,
            });
        }

        // ✅ Prevent assigning the same delivery again
        if (order.DeliveryBy?.toString() === deliveryBoyId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'This delivery is already assigned to you.',
                data: order,
            });
        }

        // ✅ Assign delivery
        order.DeliveryBy = deliveryBoyId;
        order.Status = 'current';
        deliveryBoy.OnDelivery = order._id.toString();

        await Promise.all([order.save(), deliveryBoy.save()]);
        await HandleAfterAssignDeliveryBoys(orderId);

        return res.status(200).json({
            success: true,
            message: 'Delivery boy assigned successfully.',
            data: order,
        });
    } catch (error) {
        console.error('Error in HandleAssignDeliveryBoys:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};


const HandleCheckDeliveryPending = async (req, res) => {
    try {
        const deliveryBoyId = req.Deliveryboy?._id;

        if (!deliveryBoyId) {
            return res.status(400).json({ message: 'Missing deliveryBoyId' });
        }

        const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId).populate({
            path: 'OnDelivery',
            populate: {
                path: 'OrderBy Product.ProductId',
            },
        });

        if (!deliveryBoy) {
            return res.status(404).json({ message: 'Delivery boy not found' });
        }

        if (!deliveryBoy.OnDelivery) {
            return res.status(200).json({
                success: true,
                message: 'No pending delivery.',
                hasPending: false,
            });
        }

        const order = await Orders.findById(deliveryBoy.OnDelivery)
            .populate('OrderBy', 'name email phone address') // Populate user details
            .populate('DeliveryBy') // Optional: if you want delivery boy info
            .populate('Product.ProductId');


        return res.status(200).json({
            success: true,
            message: 'You have a pending delivery.',
            hasPending: true,
            data: order,
        });

    } catch (error) {
        console.error('Error in HandleCheckDeliveryPending:', error);
        return res.status(500).json({ message: 'Server error', error });
    }
};

const HandleCompleteOrder = async (req, res) => {
  try {
    const { OrderOtp } = req.body;
    const { _id } = req.Deliveryboy;

    if (!OrderOtp) {
      return res.status(400).json({ message: 'Order OTP is required' });
    }

    const deliveryBoy = await DeliveryBoy.findById(_id).populate('OnDelivery');
    if (!deliveryBoy || !deliveryBoy.OnDelivery) {
      return res.status(404).json({ message: 'No ongoing delivery found for this delivery boy' });
    }

    const order = await Orders.findById(deliveryBoy.OnDelivery);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    
    // Check OTP
    if (order.OrderOtp !== OrderOtp) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Mark order as completed
    order.Status = 'completed';
    await order.save();

    // Update delivery boy's data
    deliveryBoy.TotalProductDelivery.push(order._id);
    deliveryBoy.OnDelivery = null;
    await deliveryBoy.save();
    

    res.status(200).json({ message: 'Order completed successfully', order });

  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


const HandleGetOrderByDeliveryId = async (req, res) => {
  try {
    const { _id } = req.Deliveryboy;

    const { page = 1, limit = 10 } = req.query; // default pagination
    const skip = (page - 1) * limit;

    // Get delivery boy by ID
    const deliveryBoy = await DeliveryBoy.findById(_id)
      .populate('TotalProductDelivery')
      .populate('DeliveryNotCompletedOrlate')
      .populate('OnDelivery');

    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found.' });
    }

    // Get OnDelivery order (if any)
    const onDeliveryOrder = deliveryBoy.OnDelivery
      ? await Orders.findById(deliveryBoy.OnDelivery)
      : null;

    // Paginate delivery history
    const totalOrdersCount = deliveryBoy.TotalProductDelivery.length;
    const paginatedOrderIds = deliveryBoy.TotalProductDelivery.slice(skip, skip + parseInt(limit));
    const paginatedOrders = await Orders.find({ _id: { $in: paginatedOrderIds } });

    return res.status(200).json({
      onDelivery: onDeliveryOrder,
      deliveryHistory: paginatedOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrdersCount / limit),
      totalOrders: totalOrdersCount,
    });
  } catch (error) {
    console.error('Error in HandleGetOrderByDeliveryId:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

cron.schedule('*/10 * * * *', async () => { // every 10 minutes
    const now = new Date();
    await DeliveryBoy.updateMany(
        { isOnline: true, onlineUntil: { $lte: now } },
        { $set: { isOnline: false } }
    );
    console.log('Checked online statuses');
});

export { HandleAddDeliveryBoys, verifyDeliveryBoyEmail, HandleGetDeliveryBoys, HandleGetDeliveryBoyProfile, HandleChangeStatusOnline, HandleAssignDeliveryBoys,HandleCheckDeliveryPending,HandleCompleteOrder,HandleGetOrderByDeliveryId }