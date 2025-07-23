import RefundDetails from '../../models/RefundDetails.js';
import Orders from '../../models/Order.js';
import User from '../../models/User.js';
import mongoose from 'mongoose';

// Get All Pending Refunds (Admin Dashboard)
const GetPendingRefunds = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'pending' } = req.query;
        const skip = (page - 1) * limit;

        const pendingRefunds = await RefundDetails.find({ status })
            .populate({
                path: 'orderId',
                select: 'totalAmount createdAt Status PaymentMethod',
                populate: {
                    path: 'Product.ProductId',
                    select: 'ProductName Images PricePerUnit'
                }
            })
            .populate('userId', 'name mobile address') // Updated: email -> mobile
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

          

        const totalCount = await RefundDetails.countDocuments({ status });
              console.log("Pending Refunds:", {
                refunds: pendingRefunds,
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            });
        res.json({
            success: true,
            data: {
                refunds: pendingRefunds,
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error("Error fetching pending refunds:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching pending refunds",
            error: error.message
        });
    }
};

// Get Single Refund Details (Admin)
const GetRefundDetails = async (req, res) => {
    const { refundId } = req.params;

    try {
        const refundDetails = await RefundDetails.findById(refundId)
            .populate({
                path: 'orderId',
                select: 'totalAmount createdAt Status PaymentMethod DeliveryCharge OrderOtp',
                populate: [
                    {
                        path: 'Product.ProductId',
                        select: 'ProductName Images PricePerUnit'
                    },
                    {
                        path: 'DeliveryBy',
                        select: 'name phone'
                    }
                ]
            })
            .populate('userId', 'name mobile address') // Updated: email -> mobile
            .populate('processedBy', 'name'); // Removed email for admin

        if (!refundDetails) {
            return res.status(404).json({
                success: false,
                message: "Refund details not found"
            });
        }

        res.json({
            success: true,
            data: refundDetails
        });
    } catch (error) {
        console.error("Error fetching refund details:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching refund details",
            error: error.message
        });
    }
};

// Process Refund (Complete/Fail)
const ProcessRefund = async (req, res) => {
    const { refundId } = req.params;
    const { 
        status, // 'completed' or 'failed'
        adminNotes, 
        refundTransactionId, 
        processedBy // Admin ID who processed it
    } = req.body;

    // Validation
    if (!['completed', 'failed'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status. Must be 'completed' or 'failed'"
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Find refund details
        const refundDetails = await RefundDetails.findById(refundId).session(session);
        if (!refundDetails) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Refund details not found"
            });
        }

        // Check if already processed
        if (refundDetails.status !== 'pending') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Refund already processed with status: ${refundDetails.status}`
            });
        }

        // Find associated order
        const order = await Orders.findById(refundDetails.orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Associated order not found"
            });
        }

        // Update refund details
        refundDetails.status = status;
        refundDetails.processedAt = new Date();
        refundDetails.adminNotes = adminNotes || '';
        refundDetails.refundTransactionId = refundTransactionId || '';
        refundDetails.processedBy = processedBy || req.admin?._id; // If you have admin auth middleware

        await refundDetails.save({ session });

        // Update order refund status
        order.RefundStatus = status === 'completed' ? 'refund_completed' : 'refund_failed';
        await order.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Send notification to user (you can implement this)
        try {
            await NotifyUserRefundStatus(refundDetails.userId, order, status, refundDetails.amount);
        } catch (notificationError) {
            console.error("Error sending refund notification:", notificationError);
        }

        res.json({
            success: true,
            message: `Refund ${status} successfully`,
            data: {
                refundId: refundDetails._id,
                orderId: order._id,
                amount: refundDetails.amount,
                status: status,
                processedAt: refundDetails.processedAt
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error processing refund:", error);
        res.status(500).json({
            success: false,
            message: "Error processing refund",
            error: error.message
        });
    }
};

// Bulk Process Refunds (Admin)
const BulkProcessRefunds = async (req, res) => {
    const { refundIds, status, adminNotes, processedBy } = req.body;

    if (!Array.isArray(refundIds) || refundIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "RefundIds array is required"
        });
    }

    if (!['completed', 'failed'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status. Must be 'completed' or 'failed'"
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const results = {
            successful: [],
            failed: []
        };

        for (const refundId of refundIds) {
            try {
                const refundDetails = await RefundDetails.findById(refundId).session(session);
                if (!refundDetails || refundDetails.status !== 'pending') {
                    results.failed.push({
                        refundId,
                        reason: 'Not found or already processed'
                    });
                    continue;
                }

                const order = await Orders.findById(refundDetails.orderId).session(session);
                if (!order) {
                    results.failed.push({
                        refundId,
                        reason: 'Associated order not found'
                    });
                    continue;
                }

                // Update refund details
                refundDetails.status = status;
                refundDetails.processedAt = new Date();
                refundDetails.adminNotes = adminNotes || '';
                refundDetails.processedBy = processedBy || req.admin?._id;

                await refundDetails.save({ session });

                // Update order
                order.RefundStatus = status === 'completed' ? 'refund_completed' : 'refund_failed';
                await order.save({ session });

                results.successful.push({
                    refundId,
                    orderId: order._id,
                    amount: refundDetails.amount
                });

            } catch (itemError) {
                results.failed.push({
                    refundId,
                    reason: itemError.message
                });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: `Bulk processing completed. ${results.successful.length} successful, ${results.failed.length} failed.`,
            data: results
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error in bulk refund processing:", error);
        res.status(500).json({
            success: false,
            message: "Error in bulk refund processing",
            error: error.message
        });
    }
};

// Get Refund Statistics (Admin Dashboard)
const GetRefundStatistics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                requestedAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        const stats = await RefundDetails.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const totalRefunds = await RefundDetails.countDocuments(dateFilter);
        const totalRefundAmount = await RefundDetails.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            success: true,
            data: {
                statistics: stats,
                totalRefunds,
                totalRefundAmount: totalRefundAmount[0]?.total || 0,
                dateRange: { startDate, endDate }
            }
        });

    } catch (error) {
        console.error("Error fetching refund statistics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching refund statistics",
            error: error.message
        });
    }
};

// Get User's Refund History (for user-facing API)
const GetUserRefundHistory = async (req, res) => {
    const userId = req.user._id; // From auth middleware
    
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        const refundHistory = await RefundDetails.find({ userId })
            .populate({
                path: 'orderId',
                select: 'totalAmount createdAt Status PaymentMethod Product',
                populate: {
                    path: 'Product.ProductId',
                    select: 'ProductName Images PricePerUnit'
                }
            })
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await RefundDetails.countDocuments({ userId });

        res.json({
            success: true,
            data: {
                refunds: refundHistory,
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error("Error fetching user refund history:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching refund history",
            error: error.message
        });
    }
};

// Helper function to notify user about refund status
const NotifyUserRefundStatus = async (userId, order, status, amount) => {
    try {
        const user = await User.findById(userId);
        if (user && user.isVerified) {
            const message = status === 'completed' 
                ? `Hi ${user.name}, your refund of ₹${amount} for order #${order._id.toString().slice(-6)} has been processed successfully.`
                : `Hi ${user.name}, your refund request for order #${order._id.toString().slice(-6)} could not be processed. Please contact support.`;
            
            // Send SMS notification using user.mobile
            console.log(`SMS to ${user.mobile}: ${message}`);
            
            // You can integrate with SMS services like Twilio, AWS SNS, etc.
            // await sendSMS(user.mobile, message);
        }
    } catch (error) {
        console.error("Error sending refund notification:", error);
    }
};

export {
    GetPendingRefunds,
    GetRefundDetails,
    ProcessRefund,
    BulkProcessRefunds,
    GetRefundStatistics,
    GetUserRefundHistory
};