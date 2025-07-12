import User from "../../models/User.js"
import DeliveryBoy from '../../models/DeliveryBoy.js'
import Orders from "../../models/Order.js"
import Product from "../../models/Product.js"


const HandleAddToCard = async (req, res) => {
    const userId = req.user._id;
    const { productId, deliveryBoyId, deliveryTime } = req.body;

    if (!productId || !deliveryBoyId || !deliveryTime) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: productId, deliveryBoyId, deliveryTime",
        });
    }

    try {
        const user = await User.findById(userId);
        const product = await Product.findById(productId);
        const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);

        if (!user || !product || !deliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "User, Product or Delivery Boy not found",
            });
        }

        // Create new order
        const newOrder = new Orders({
            ProductId: productId,
            DeliveryTime: deliveryTime,
            DeliveryBy: deliveryBoyId,
            OrderBy: userId,
        });

        await newOrder.save();

        // Add order to DeliveryBoy's deliveries
        deliveryBoy.TotalProductDelivery.push(newOrder._id);
        await deliveryBoy.save();

        // Optional: If User has an 'orders' field, update it too
        // user.orders.push(newOrder._id);
        // await user.save();

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: newOrder._id,
        });
    } catch (error) {
        console.error("Error in HandleAddToCard:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


export {
    HandleAddToCard
}