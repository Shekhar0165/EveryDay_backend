import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

class Database {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            ...options 
        };
    }

    connect = async () => {
        try {
            await mongoose.connect(this.url, this.options);
            console.log('MongoDB connection successful');
        } catch (error) {
            console.error('MongoDB connection error:', error);
        }
    }

    disconnect = async () => {
        try {
            await mongoose.disconnect();
            console.log('MongoDB disconnected');
        } catch (err) {
            console.error('Disconnection error:', err);
        }
    }    
}

// eslint-disable-next-line no-undef
const dbconnect = new Database(process.env.DATABASE)
// eslint-disable-next-line no-undef
console.log('Database URL:', process.env.DATABASE);

export default dbconnect;