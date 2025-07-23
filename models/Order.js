import mongoose from 'mongoose';

const OrdersSchema = new mongoose.Schema({
    Product:[
        {
            ProductId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            units: {
                type: String,
                required: true
            }
        }
    ],
    DeliveryTime: {
        type: String,
    },
    totalAmount:{
        type:Number
    },
    DeliveryBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryBoy',
        default: null
    },
    Status:{
        type:String,
        enum: ['prepare','current', 'cancel','completed']
    },
    OrderBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    DeliveryCharge:{
        type:Number,
        default:0
    },
    OrderOtp:{
        type:String,
        default:"498273"
    },
    PaymentMethod: {
        type: String,
        enum: ['cod', 'razorpay'],
        required: true,
        default: 'cod'
    },
    PaymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cod'],
        default: 'pending'
    },
    PaymentId: {
        type: String, // Razorpay payment ID
        default: null
    },
    RazorpayOrderId: {
        type: String, // Razorpay order ID
        default: null
    },
    // Refund Related Fields
    RefundStatus: {
        type: String,
        enum: ['not_applicable', 'pending_manual_refund', 'refund_completed', 'refund_failed'],
        default: 'not_applicable'
    },
    RefundDetailsId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RefundDetails',
        default: null
    },
    CancelledAt: {
        type: Date
    },
    CancelReason: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});



const Orders = mongoose.model('Orders', OrdersSchema);

export default Orders;
