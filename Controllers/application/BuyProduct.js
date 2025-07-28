import User from '../../models/User.js'
import Product from '../../models/Product.js'
import Orders from '../../models/Order.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { HandleSendOrderToShop } from './Socket.js';
const { Client, LocalAuth } = pkg;


const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '../../.wwebjs_auth',
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

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Razorpay Order
const HandleCreateRazorpayOrder = async (req, res) => {
    const UserId = req.user._id;
    const { amount, currency = 'INR' } = req.body;

    try {
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency,
            receipt: `receipt_order_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

// Updated Place Order Function
const HandlePlaceOrder = async (req, res) => {
    const UserId = req.user._id;
    const { product, paymentMethod, razorpayPaymentData } = req.body;
    console.log('Placing order for user:', UserId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findById(UserId).session(session);

        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const updatedProductList = [];
        let totalAmount = 0;

        for (const item of product) {
            const { ProductId, units } = item;

            if (!mongoose.Types.ObjectId.isValid(ProductId)) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Invalid ProductId: ${ProductId}`
                });
            }

            const foundProduct = await Product.findById(ProductId).session(session);
            if (!foundProduct) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${ProductId}`
                });
            }

            totalAmount = totalAmount + (foundProduct.PricePerUnit * units);

            const orderUnits = parseInt(units);
            if (isNaN(orderUnits) || orderUnits <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Invalid quantity for product ${foundProduct.ProductName}`
                });
            }

            if (foundProduct.Stock < orderUnits) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ${foundProduct.ProductName}`
                });
            }

            // Deduct stock
            foundProduct.Stock -= orderUnits;
            await foundProduct.save({ session });

            updatedProductList.push({
                ProductId: foundProduct._id,
                units: orderUnits.toString()
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        let DeliveryCharge = 0;

        if (totalAmount < 99) {
            totalAmount += 20;
            DeliveryCharge = 20;
        }

        // Handle payment verification for online payments
        let paymentStatus = 'pending';
        let paymentId = null;

        if (paymentMethod === 'razorpay' && razorpayPaymentData) {
            // Verify Razorpay payment
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = razorpayPaymentData;

            const sign = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest('hex');

            if (razorpay_signature === expectedSign) {
                paymentStatus = 'completed';
                paymentId = razorpay_payment_id;
            } else {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Payment verification failed'
                });
            }
        } else if (paymentMethod === 'cod') {
            paymentStatus = 'cod';
        }

        // Create and save order
        const newOrder = new Orders({
            Product: updatedProductList,
            OrderBy: UserId,
            Status: "prepare",
            totalAmount: totalAmount,
            OrderOtp: otp,
            DeliveryCharge: DeliveryCharge,
            PaymentMethod: paymentMethod,
            PaymentStatus: paymentStatus,
            PaymentId: paymentId,
            RazorpayOrderId: razorpayPaymentData?.razorpay_order_id || null
        });
        await newOrder.save({ session });

        // Add order ID to user
        user.Orders.push(newOrder._id);

        // Clear cart
        user.AddToCard = [];

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Send order to shop via socket
        try {
            const completeOrder = await Orders.findById(newOrder._id)
                .populate('Product.ProductId', 'name price Images')
                .populate('DeliveryBy', 'name phone')
                .populate('OrderBy', 'name email mobile address');

            if (completeOrder) {
                HandleSendOrderToShop(completeOrder, user);
            }
        } catch (socketError) {
            console.error("Error sending order to admin via socket:", socketError);
        }

        const number = '+918218875959'

        const chatId = number.replace('+', '') + '@c.us';

        const message = `shekhar Get An Order From User Please Check Your Dashboard`;

        const sentMessage = await client.sendMessage(chatId, message);

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: newOrder
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error placing order:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while placing order"
        });
    }
};

export {
    HandlePlaceOrder,
    HandleCreateRazorpayOrder
};