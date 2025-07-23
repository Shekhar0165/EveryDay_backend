import User from "../../models/User.js"
import DeliveryBoy from '../../models/DeliveryBoy.js'
import Orders from "../../models/Order.js"
import Product from "../../models/Product.js"
import { HandleNotifyDeliveryBoy, HandleNotifyToShop } from "./Socket.js"
import mongoose from "mongoose";
import RefundDetails from "../../models/RefundDetails.js"


const HandleAddToCard = async (req, res) => {
    const userId = req.user._id;
    const { productId, deliveryBoyId, deliveryTime } = req.body;

    if (!productId || !deliveryBoyId || !deliveryTime) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: productId, deliveryBoyId, deliveryTime",
        });
    }

    try {
        const user = await User.findById(userId);
        const product = await Product.findById(productId);
        const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

        if (!user || !product || !deliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "User, Product or Delivery Boy not found",
            });
        }

        // Create new order
        const newOrder = new Orders({
            ProductId: productId,
            DeliveryTime: deliveryTime,
            DeliveryBy: deliveryBoyId,
            OrderBy: userId,
        });

        await newOrder.save();

        // Add order to DeliveryBoy's deliveries
        deliveryBoy.TotalProductDelivery.push(newOrder._id);
        await deliveryBoy.save();

        // Optional: If User has an 'orders' field, update it too
        // user.orders.push(newOrder._id);
        // await user.save();

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: newOrder._id,
        });
    } catch (error) {
        console.error("Error in HandleAddToCard:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


const HandleGetOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        // const userId = req.admin._id 

        // If specific order ID is provided
        if (orderId) {
            const order = await Orders.findById(orderId)
                .populate('Product.ProductId', 'name price image') // Populate product details
                .populate('DeliveryBy', 'name phone') // Populate delivery boy details
                .populate('OrderBy', 'name email phone'); 

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }



            return res.status(200).json({
                success: true,
                order
            });
        }

        // If no specific order ID, get all orders for the user
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log(req.query)

        // Build base query
        const query = {};

        // Add filters
        const { status, deliveryBy, dateFrom, dateTo, minAmount, maxAmount } = req.query;

        // Filter by status
        if (status) {
            const validStatuses = ['prepare','current', 'cancel', 'completed'];
            if (validStatuses.includes(status)) {
                query.Status = status;
            }
        }

        // Filter by delivery person
        if (deliveryBy) {
            query.DeliveryBy = deliveryBy;
        }

        // Filter by date range
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) {
                query.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.createdAt.$lte = new Date(dateTo);
            }
        }

        // Filter by amount range
        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) {
                query.totalAmount.$gte = parseFloat(minAmount);
            }
            if (maxAmount) {
                query.totalAmount.$lte = parseFloat(maxAmount);
            }
        }

        const orders = await Orders.find(query)
            .populate('Product.ProductId', 'ProductName PricePerUnit Images')
            .populate('DeliveryBy', 'name phone')
            .populate('OrderBy','name email mobile address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Orders.countDocuments(query);

        // console.log({
        //     success: true,
        //     orders,
        //     filters: {
        //         status,
        //         deliveryBy,
        //         dateFrom,
        //         dateTo,
        //         minAmount,
        //         maxAmount
        //     },
        //     pagination: {
        //         currentPage: page,
        //         totalPages: Math.ceil(totalOrders / limit),
        //         totalOrders,
        //         hasNext: page < Math.ceil(totalOrders / limit),
        //         hasPrev: page > 1
        //     }
        // })

        res.status(200).json({
            success: true,
            orders,
            filters: {
                status,
                deliveryBy,
                dateFrom,
                dateTo,
                minAmount,
                maxAmount
            },
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalOrders / limit),
                totalOrders,
                hasNext: page < Math.ceil(totalOrders / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error in HandleGetOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


const HandleGetOneOrderFromId = async (req, res) => {
    const { OrderId } = req.params;


    try {
        const order = await Orders.findById(OrderId)
            .populate('OrderBy', 'name email phone address') // Populate user details
            .populate('DeliveryBy') // Optional: if you want delivery boy info
            .populate('Product.ProductId');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }
        // If order is found, send it in the response
        res.status(200).json({
            success: true,
            message: 'Order fetched successfully',
            data: order,
        });



    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
        });
    }
};


const HandleGetOrderForUser = async (req, res) => {
    try {
        const UserId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search?.trim() || "";
        const status = req.query.status?.trim();
        console.log(UserId, page, limit, search, status);

        const statusMap = {
            current: ['current', 'prepare'],
            past: ['completed'],
            past: ['completed'],
            cancel: ['cancel']
        };

        const buildQuery = (statuses) => ({
            OrderBy: UserId,
            Status: { $in: statuses }
        });

        const getOrders = async (statuses) => {
            const skip = (page - 1) * limit;

            const orders = await Orders.find(buildQuery(statuses))
                .populate({
                    path: 'Product.ProductId',
                    match: search
                        ? { ProductName: { $regex: search, $options: 'i' } }
                        : {}, // Use correct field name: ProductName
                })
                .populate('DeliveryBy')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // Only filter orders if search is applied
            if (search) {
                return orders.filter(order =>
                    order.Product.some(p => p.ProductId !== null)
                );
            }

            return orders;
        };

        if (status && statusMap[status]) {
            const filteredOrders = await getOrders(statusMap[status]);
            return res.status(200).json({
                success: true,
                message: `Fetched ${status} orders successfully`,
                page,
                limit,
                data: filteredOrders
            });
        }

        const [currentOrders, pastOrders, cancelledOrders] = await Promise.all([
            getOrders(statusMap.current),
            getOrders(statusMap.past),
            getOrders(statusMap.cancel)
        ]);

        return res.status(200).json({
            success: true,
            message: "Fetched all types of orders",
            page,
            limit,
            data: {
                currentOrders,
                pastOrders,
                cancelledOrders
            }
        });

    } catch (error) {
        console.error("Error fetching orders:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message
        });
    }
};



const HandleCancelOrder = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user._id;
    console.log('Cancel Order Request:', orderId, userId);
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const order = await Orders.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.OrderBy.toString() !== userId.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(401).json({
                success: false,
                message: "You are not authorized to cancel this order"
            });
        }
        
        if (order.Status === "cancel") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Order is already cancelled"
            });
        }

        // Restore stock for cancelled products
        for (const item of order.Product) {
            const product = await Product.findById(item.ProductId).session(session);
            if (product) {
                product.Stock += parseInt(item.units);
                await product.save({ session });
            }
        }

        // Handle refund based on payment method
        let refundStatus = 'not_applicable';
        let refundDetailsId = null;
        
        if (order.PaymentMethod === 'razorpay' && order.PaymentStatus === 'completed') {
            refundStatus = 'pending_manual_refund';
            
            // Create separate RefundDetails record
            const newRefundDetails = new RefundDetails({
                orderId: order._id,
                userId: userId,
                amount: order.totalAmount,
                paymentId: order.PaymentId,
                razorpayOrderId: order.RazorpayOrderId,
                requestedAt: new Date(),
                status: 'pending',
                refundMethod: 'manual'
            });
            
            const savedRefundDetails = await newRefundDetails.save({ session });
            refundDetailsId = savedRefundDetails._id;
        }

        // Update order status
        order.Status = "cancel";
        order.RefundStatus = refundStatus;
        order.RefundDetailsId = refundDetailsId;
        order.CancelledAt = new Date();
        order.CancelReason = 'Cancelled by user';
        
        await order.save({ session });

        // Handle delivery boy updates
        if(order.DeliveryBy) {
            const deliveryBoy = await DeliveryBoy.findById(order.DeliveryBy).session(session);
            if (deliveryBoy) {
                deliveryBoy.DeliveryNotCompletedOrlate.push(order._id);
                deliveryBoy.OnDelivery = null; // Reset OnDelivery status
                await deliveryBoy.save({ session });
            }
            HandleNotifyDeliveryBoy(order.DeliveryBy, order._id, "Order cancelled by user");
        }

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Send notifications
        HandleNotifyToShop(order.Shop, order._id, "Order cancelled by user");
        
        // Prepare response message based on refund status
        let responseMessage = "Order cancelled successfully";
        if (refundStatus === 'pending_manual_refund') {
            responseMessage += `. Refund of ₹${order.totalAmount} will be processed manually within 3-5 business days.`;
        }

        return res.status(200).json({
            success: true,
            message: responseMessage,
            data: {
                order: order,
                refundDetails: refundStatus === 'pending_manual_refund' ? {
                    refundId: refundDetailsId,
                    amount: order.totalAmount,
                    status: refundStatus,
                    estimatedProcessingTime: '3-5 business days'
                } : null
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error cancelling order:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};



export {
    HandleAddToCard,
    HandleGetOrder,
    HandleGetOneOrderFromId,
    HandleGetOrderForUser,
    HandleCancelOrder
}