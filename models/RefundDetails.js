import mongoose from 'mongoose';

const RefundDetailsSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Orders',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    refundMethod: {
        type: String,
        enum: ['manual', 'auto'],
        default: 'manual'
    },
    adminNotes: {
        type: String
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin' 
    },
    refundTransactionId: {
        type: String 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const RefundDetails = mongoose.model('RefundDetails', RefundDetailsSchema);

export default RefundDetails;