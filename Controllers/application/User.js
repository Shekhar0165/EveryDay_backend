import User from "../../models/User.js";
import axios from "axios";

// Load from .env
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;


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

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};


const HandleGetUserLocation = async (req, res) => {
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
            mobile:user.mobile
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


export { HandlePreviewUserLocation,
    HandleSaveUserLocation,
    HandleGetUserLocation
 };
