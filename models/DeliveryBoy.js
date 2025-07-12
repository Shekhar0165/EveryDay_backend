import mongoose from 'mongoose';

const DeliveryBoySchema = new mongoose.Schema({
    name: {
        type: String
    },
    mobile: {
        type: String,
        required: true
    },
    email:{
        type:String,
        required:true
    },
    userid:{
        type:String,
        required:true,
        trim: true
    },  
    password:{
        type:String,
        required:true
    },
    Shop: {
        type: String
    },
    TotalProductDelivery: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Orders'
        }
    ],
    DeliveryNotCompletedOrlate: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Orders'
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    }
});


const DeliveryBoy = mongoose.model('DeliveryBoy', DeliveryBoySchema);

export default DeliveryBoy;
