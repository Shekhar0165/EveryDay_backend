import mongoose from 'mongoose';

const DeliveryBoySchema = new mongoose.Schema({
    name: {
        type: String
    },
    mobile: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    avatar: {
        type: String,
        default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'
    },
    password: {
        type: String,
        required: true
    },
    Shop: {
        type: String
    },
    onlineUntil: {
        type: Date
    },
    isVerified: { type: Boolean, default: false },
    TotalProductDelivery: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Orders'
        }
    ],
    OnDelivery: {
        type: String,
        default:null
    },
    DeliveryNotCompletedOrlate: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Orders'
        }
    ],
    rating: {
        type: Number,
        default: 0
    },
    refreshToken: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const DeliveryBoy = mongoose.model('DeliveryBoy', DeliveryBoySchema);

export default DeliveryBoy;
