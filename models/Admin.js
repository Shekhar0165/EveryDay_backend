import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
    adminid: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    refreshToken: {
        type: String,
    },
    Coordinates: {
        latitude: {
            type: Number
        },
        longitude: {
            type: Number
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Admin = mongoose.model("Admin", AdminSchema);

export default Admin;