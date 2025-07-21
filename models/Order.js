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
    paymentMethod:{
        type:String,
        default:'COD'
    },
    DeliveryCharge:{
        type:Number,
        default:0
    },
    OrderOtp:{
        type:String,
        default:"498273"
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});


const Orders = mongoose.model('Orders', OrdersSchema);

export default Orders;
