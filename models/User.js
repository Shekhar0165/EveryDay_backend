import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    mobile: {
        type: String,
        required: true,
        unique: true,
    },
    email:{
        type:String,
        default:"no Email"
    },
    ProfileImage:{
        type:String,
        default:'https://res-console.cloudinary.com/dt9kpgtli/thumbnails/v1/image/upload/v1750145996/dXNlcnMvcGx3djNoY3hzd2JkZWh2OXd0YmQ=/drilldown'
    },
    address: {
        formatted: { type: String },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: true,
            },
        },
    },
    AddToCard: [
        {
            ProductId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            units: {
                type: Number,
                default: 1
            }
        }
    ],
    Orders: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Orders'
        }
    ],
    otp: {
        type: String,
        select: false,
    },
    otpExpiresAt: {
        type: Date,
        select: false,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    refreshToken: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const User = mongoose.model('User', userSchema);

export default User;
