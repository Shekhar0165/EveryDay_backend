import mongoose from 'mongoose';

const OrdersSchema = new mongoose.Schema({
    ProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    DeliveryTime: {
        type: String,
    },
    DeliveryBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryBoy'
    },
    OrderBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});


const Orders = mongoose.model('Orders', OrdersSchema);

export default Orders;
