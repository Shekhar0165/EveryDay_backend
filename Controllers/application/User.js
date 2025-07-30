import mongoose from "mongoose";
import Admin from "../../models/Admin.js";
import User from "../../models/User.js";
import axios from "axios";
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Load from .env
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;


// Setup your nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});


const HandlePreviewUserLocation = async (req, res) => {
    const { latitude, longitude } = req.body;

    console.log('Preview location:', { latitude, longitude });

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Latitude and longitude required" });
    }

    try {
        // Fetch formatted address from Google Maps
        const geoRes = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );

        const formatted = geoRes.data?.results?.[0]?.formatted_address || "Unknown location";
        console.log('Formatted address:', formatted);

        return res.status(200).json({
            success: true,
            address: formatted,
            message: "Address fetched successfully"
        });

    } catch (error) {
        console.error("Location preview error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch address",
            error: error.message
        });
    }
};

// Save location endpoint - saves to database
const HandleSaveUserLocation = async (req, res) => {
    const userId = req.user._id;
    const { latitude, longitude } = req.body;

    console.log('Save location:', { userId, latitude, longitude });

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Latitude and longitude required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const previousCoords = user.address?.location?.coordinates || [];
        const [prevLng, prevLat] = previousCoords;

        // First time saving
        if (!prevLat || !prevLng) {
            // Fetch formatted address from Google Maps
            const geoRes = await axios.get(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
            );

            const formatted = geoRes.data?.results?.[0]?.formatted_address || "Unknown location";
            console.log('First time save - formatted address:', formatted);

            user.address = {
                formatted,
                location: {
                    type: "Point",
                    coordinates: [longitude, latitude]
                }
            };

            await user.save();
            return res.status(200).json({
                success: true,
                message: "Location saved successfully",
                address: formatted,
                isFirstTime: true
            });
        }

        // If location exists, calculate movement
        const distance = getDistanceFromLatLonInMeters(prevLat, prevLng, latitude, longitude);

        if (distance >= 100) {
            // Fetch new formatted address
            const geoRes = await axios.get(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const formatted = geoRes.data?.results?.[0]?.formatted_address || "Unknown location";

            user.address.formatted = formatted;
            user.address.location.coordinates = [longitude, latitude];
            await user.save();

            return res.status(200).json({
                success: true,
                message: `Location saved successfully`,
                address: formatted,
                distance: Math.round(distance)
            });
        } else {
            // Return existing address without updating
            return res.status(200).json({
                success: true,
                message: `Location saved successfully`,
                address: user.address.formatted,
                distance: Math.round(distance)
            });
        }

    } catch (error) {
        console.error("Location save error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to save location",
            error: error.message
        });
    }
};

// Helper function to calculate distance between two points
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d * 1000; // Convert to meters
};

const HandleCheckWeAreThere = async (req, res) => {
    const { latitude, longitude } = req.body;
    console.log('Check location:', { latitude, longitude });

    if (!latitude || !longitude) {
        return res.status(400).json({
            success: false,
            message: "Latitude and longitude required"
        });
    }

    try {
        // Find admins within 3km radius of the given coordinates
        const admins = await Admin.find({
            "Coordinates.latitude": { $exists: true },
            "Coordinates.longitude": { $exists: true }
        });

        // Filter admins by distance (3000 meters = 3km)
        const nearbyAdmins = admins.filter(admin => {
            if (!admin.Coordinates.latitude || !admin.Coordinates.longitude) {
                return false;
            }

            console.log('Admin coordinates:', {
                latitude: admin.Coordinates.latitude,
                longitude: admin.Coordinates.longitude
            });

            const distance = calculateDistance(
                latitude,
                longitude,
                admin.Coordinates.latitude,
                admin.Coordinates.longitude
            );

            return distance <= 3000; // 3km in meters
        });

        return res.status(200).json({
            success: true,
            admins: nearbyAdmins,
            count: nearbyAdmins.length,
            message: nearbyAdmins.length > 0
                ? "Shop found nearby"
                : "No shops found in the area"
        });

    } catch (error) {
        console.error("Location check error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check shop locations",
            error: error.message
        });
    }
};

// Helper function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}


const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};


const HandleGetUserProfile = async (req, res) => {
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.address || !user.address.location || !user.address.location.coordinates?.length) {
            return res.status(404).json({
                success: false,
                message: "User location not set"
            });
        }

        const { formatted, location } = user.address;

        return res.status(200).json({
            success: true,
            message: "User location fetched successfully",
            location: {
                address: formatted,
                coordinates: location.coordinates // [longitude, latitude]
            },
            mobile: user.mobile,
            email: user.email,
            profileImage: user.ProfileImage,
            joinDate: user.createdAt,
            totalOrders: user.Orders.length,
            name: user.name
        });

    } catch (error) {
        console.error("Error fetching user location:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user._id; // Assuming user ID comes from auth middleware
        const { name, email, mobile, ProfileImage } = req.body;
        console.log(req.body)

        // Validate user ID
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        console.log(user)

        // Prepare update object with only allowed fields
        const updateData = {};

        // Validate and update name
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Name must be a non-empty string'
                });
            }
            updateData.name = name.trim();
        }

        // Validate and update email
        if (email !== undefined) {
            if (typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Email must be a string'
                });
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email.trim() !== '' && !emailRegex.test(email.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address'
                });
            }

            updateData.email = email.trim() || 'no Email';
        }

        // Validate and update mobile (check for uniqueness)
        if (mobile !== undefined) {
            if (typeof mobile !== 'string' || mobile.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mobile number must be a non-empty string'
                });
            }

            // Basic mobile validation (adjust regex as per your requirements)
            const mobileRegex = /^[0-9]{10,15}$/;
            if (!mobileRegex.test(mobile.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid mobile number (10-15 digits)'
                });
            }

            // Check if mobile number already exists for another user
            const existingUser = await User.findOne({
                mobile: mobile.trim(),
                _id: { $ne: userId }
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Mobile number already exists'
                });
            }

            updateData.mobile = mobile.trim();
        }

        // Validate and update profile image
        if (ProfileImage !== undefined) {
            if (typeof ProfileImage !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Profile image must be a string (URL)'
                });
            }
            updateData.ProfileImage = ProfileImage.trim();
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update'
            });
        }

        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            {
                new: true,
                runValidators: true,
                select: '-otp -otpExpiresAt -refreshToken' // Exclude sensitive fields
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    mobile: updatedUser.mobile,
                    ProfileImage: updatedUser.ProfileImage,
                    address: updatedUser.address,
                    isVerified: updatedUser.isVerified,
                    createdAt: updatedUser.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Error updating user profile:', error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Mobile number already exists'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const checkUser = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        const user = await User.findOne({ mobile });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has email
        if (user.email === 'no Email') {
            return res.status(200).json({ hasEmail: false });
        }

        return res.status(200).json({ hasEmail: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 2. Send verification code to user email after verifying phone+email match
const sendVerification = async (req, res) => {
    try {
        const { mobile, email } = req.body;
        if (!mobile || !email) {
            return res.status(400).json({ message: 'Mobile and email are required' });
        }

        const user = await User.findOne({ mobile, email });
        if (!user) {
            return res.status(400).json({ message: 'Mobile and email do not match any account' });
        }

        // Generate OTP and expiry (e.g., 10 minutes)
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.isVerified = false;
        await user.save();

        // Send email with OTP
        await transporter.sendMail({
            from: `"Valon Support" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Your Verification Code',
            text: `Hi,\n\nYour verification code to delete your account is: ${otp}\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore.`,
        });

        res.status(200).json({ message: 'Verification code sent' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 3. Verify OTP and delete account
const verifyAndDelete = async (req, res) => {
    try {
        const { mobile, email, verificationCode } = req.body;
        if (!mobile || !email || !verificationCode) {
            return res.status(400).json({ message: 'Mobile, email and verification code are required' });
        }

        const user = await User.findOne({ mobile, email }).select('+otp +otpExpiresAt');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check OTP validity and expiration
        if (user.otp !== verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        if (new Date() > user.otpExpiresAt) {
            return res.status(400).json({ message: 'Verification code expired' });
        }

        // Delete user
        await User.deleteOne({ _id: user._id });

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


export {
    HandlePreviewUserLocation,
    HandleSaveUserLocation,
    HandleGetUserProfile,
    HandleCheckWeAreThere,
    updateUserProfile,
    checkUser,
    sendVerification,
    verifyAndDelete
};
