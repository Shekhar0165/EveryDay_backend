import Product from "../../models/Product.js";

let globalSocket, globalIo;


const HandleConnectToAdmin = (socket, io) => {
    globalSocket = socket;
    globalIo = io;
};


const HandleSendOrderToShop = async (completeOrder, user) => {
    console.log('completeOrder', completeOrder, 'user', user);

    if (!globalSocket || !globalSocket.connected) {
        console.error('Socket not connected to admin');
        return false;
    }

    console.log('Sending complete order to admin:', completeOrder);

    try {
        // The order is already populated with all necessary data
        // Just emit it directly to the admin dashboard
        globalSocket.emit("send-order", completeOrder);
        return true;
    } catch (error) {
        console.error('Error sending order to admin:', error);
        return false;
    }
};

const HandleAfterAssignDeliveryBoys = async (orderId) => {
    if (!globalSocket || !globalSocket.connected) {
        console.error('Socket not connected to admin');
        return false;
    }
    try {
        globalSocket.emit("Assign-Delivery_boy", orderId);
        return true;
    } catch (error) {
        console.error('Error sending order to admin:', error);
        return false;
    }
}

const HandleNotifyToShop = () => {

}

const HandleTrackOrder = (socket, io) => {
    // Handle delivery boy location updates (matches your frontend event)
    socket.on('Delivery-boy-location', (data) => {
        const { latitude, longitude, accuracy, timestamp } = data;

        console.log('Location received from delivery boy:', {
            socketId: socket.id,
            latitude,
            longitude,
            accuracy,
            timestamp: timestamp || new Date()
        });
    })
};

export {
    HandleConnectToAdmin,
    HandleSendOrderToShop,
    HandleAfterAssignDeliveryBoys,
    HandleNotifyToShop,
    HandleTrackOrder
}