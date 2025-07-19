import User from '../../models/User.js'
import Product from '../../models/Product.js'
import Orders from '../../models/Order.js';
import mongoose from 'mongoose';
import { HandleSendOrderToShop } from './Socket.js';


const HandlePlaceOrder = async (req, res) => {
    const UserId = req.user._id;
    const { product } = req.body;

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
        const otp =Math.floor(100000 + Math.random() * 900000).toString();

        // Create and save order
        const newOrder = new Orders({
            Product: updatedProductList,
            OrderBy: UserId,
            Status: "prepare",
            totalAmount: totalAmount,
            OrderOtp:otp
        });
        await newOrder.save({ session });

        // Add order ID to user
        user.Orders.push(newOrder._id);

        // Clear cart
        user.AddToCard = [];

        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // ✅ UPDATED: Fetch the complete order with populated fields for socket
        try {
            const completeOrder = await Orders.findById(newOrder._id)
                .populate('Product.ProductId', 'name price Images')
                .populate('DeliveryBy', 'name phone')
                .populate('OrderBy', 'name email mobile address');

            if (completeOrder) {
                // Send the complete populated order to admin via socket
                HandleSendOrderToShop(completeOrder, user);
            }
        } catch (socketError) {
            console.error("Error sending order to admin via socket:", socketError);
            // Don't fail the API response if socket fails
        }

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





export { HandlePlaceOrder }