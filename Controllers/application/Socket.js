import { getBoyDataFromToken } from "../../middleware/DeliveryBoysAuth.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";

let globalSocket, globalIo, redisClient;

// Redis key prefixes for organization
const REDIS_KEYS = {
  DELIVERY_LOCATION: 'delivery_location:',
  ORDER_TRACKING: 'order_tracking:',
  USER_SOCKET: 'user_socket:',
  DELIVERY_BOY_SOCKET: 'delivery_boy_socket:'
};

const HandleConnectToAdmin = (socket, io, client) => {
  globalSocket = socket;
  globalIo = io;
  redisClient = client;
};

const HandleSendOrderToShop = async (completeOrder, user) => {
  console.log('completeOrder', completeOrder, 'user', user);

  if (!globalSocket || !globalSocket.connected) {
    console.error('Socket not connected to admin');
    return false;
  }

  console.log('Sending complete order to admin:', completeOrder);

  try {
    // Store order tracking info in Redis (updated for Redis client v4+)
    await redisClient.setEx(
      `${REDIS_KEYS.ORDER_TRACKING}${completeOrder._id}`,
      86400, // 24 hours expiry
      JSON.stringify({
        orderId: completeOrder._id,
        userId: user._id,
        status: 'pending',
        createdAt: new Date()
      })
    );

    globalSocket.emit("send-order", completeOrder);
    return true;
  } catch (error) {
    console.error('Error sending order to admin:', error);
    return false;
  }
};

const HandleAfterAssignDeliveryBoys = async (orderId, deliveryBoyId) => {
  if (!globalSocket || !globalSocket.connected) {
    console.error('Socket not connected to admin');
    return false;
  }
  
  try {
    // Update order tracking in Redis with delivery boy assignment
    const trackingKey = `${REDIS_KEYS.ORDER_TRACKING}${orderId}`;
    const trackingData = await redisClient.get(trackingKey);
    
    if (trackingData) {
      const parsedData = JSON.parse(trackingData);
      parsedData.deliveryBoyId = deliveryBoyId;
      parsedData.status = 'assigned';
      parsedData.assignedAt = new Date();
      
      await redisClient.setEx(trackingKey, 86400, JSON.stringify(parsedData));
    }

    globalSocket.emit("Assign-Delivery_boy", { orderId, deliveryBoyId });
    return true;
  } catch (error) {
    console.error('Error assigning delivery boy:', error);
    return false;
  }
};

const HandleNotifyToShop = () => {
  // Implementation for shop notifications
};

const HandleTrackOrder = (socket, io, client) => {
  
  // Handle delivery boy location updates
  socket.on('Delivery-boy-location', async (data) => {
    try {
      const { latitude, longitude, accuracy, timestamp, token } = data;

      // Validate required fields
      if (!latitude || !longitude || !token) {
        console.error('Missing required location data');
        return;
      }

      const deliveryboy = await getBoyDataFromToken(token);
      if (!deliveryboy) {
        console.log("Delivery boy not found for token.");
        socket.emit('error', { message: 'Invalid delivery boy token' });
        return;
      }

      const orderId = deliveryboy.OnDelivery;
      if (!orderId) {
        console.log("No active delivery for this delivery boy.");
        return;
      }

      const order = await Order.findById(orderId);
      if (!order) {
        console.log("Order not found.");
        return;
      }

      const userId = order.OrderBy;
      const user = await User.findById(userId);
      if (!user) {
        console.log("User not found for order.");
        return;
      }

      // Store delivery boy's current location in Redis
      const locationData = {
        deliveryBoyId: deliveryboy._id,
        orderId: orderId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy || null,
        timestamp: timestamp || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Store location with 1 hour expiry (updated for Redis client v4+)
      await redisClient.setEx(
        `${REDIS_KEYS.DELIVERY_LOCATION}${deliveryboy._id}`,
        3600,
        JSON.stringify(locationData)
      );

      // Also store mapping from order to delivery boy location
      await redisClient.setEx(
        `${REDIS_KEYS.ORDER_TRACKING}${orderId}_location`,
        3600,
        JSON.stringify(locationData)
      );

      console.log('Location stored for delivery boy:', {
        deliveryBoyId: deliveryboy._id,
        orderId: orderId,
        latitude,
        longitude,
        timestamp: locationData.timestamp
      });

      // Broadcast location to specific user who placed the order
      const userSocketKey = `${REDIS_KEYS.USER_SOCKET}${userId}`;
      const userSocketId = await redisClient.get(userSocketKey);
      
      if (userSocketId) {
        io.to(userSocketId).emit('delivery-location-update', {
          orderId: orderId,
          location: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            timestamp: locationData.timestamp
          },
          deliveryBoyInfo: {
            name: deliveryboy.name || 'Delivery Partner',
            phone: deliveryboy.phone || null
          }
        });
      }

      // Acknowledge receipt to delivery boy
      socket.emit('location-received', {
        success: true,
        timestamp: locationData.timestamp
      });

    } catch (error) {
      console.error('Error handling delivery-boy-location:', error.message);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Handle user tracking requests
  socket.on('Track-Order', async (data) => {
    try {
      const { orderId, userId } = data;
      
      if (!orderId) {
        socket.emit('error', { message: 'Order ID is required' });
        return;
      }

      console.log('Track-Order request:', { orderId, userId });

      // Verify user owns this order
      const order = await Order.findById(orderId);
      if (!order) {
        socket.emit('error', { message: 'Order not found' });
        return;
      }

      if (userId && order.OrderBy.toString() !== userId.toString()) {
        socket.emit('error', { message: 'Unauthorized to track this order' });
        return;
      }

      // Store user's socket ID in Redis for location updates
      if (userId) {
        await redisClient.setEx(
          `${REDIS_KEYS.USER_SOCKET}${userId}`,
          86400, // 24 hours
          socket.id
        );
      }

      // Get current location from Redis if available
      const locationKey = `${REDIS_KEYS.ORDER_TRACKING}${orderId}_location`;
      const locationData = await redisClient.get(locationKey);

      if (locationData) {
        const parsedLocation = JSON.parse(locationData);
        socket.emit('current-delivery-location', {
          orderId: orderId,
          location: {
            latitude: parsedLocation.latitude,
            longitude: parsedLocation.longitude,
            accuracy: parsedLocation.accuracy,
            timestamp: parsedLocation.timestamp
          },
          lastUpdated: parsedLocation.lastUpdated
        });
      } else {
        socket.emit('tracking-status', {
          orderId: orderId,
          message: 'Order is being prepared or delivery boy location not available yet',
          status: order.status || 'preparing'
        });
      }

    } catch (error) {
      console.error('Error handling Track-Order:', error.message);
      socket.emit('error', { message: 'Failed to track order' });
    }
  });

  // Handle delivery boy connection
  socket.on('delivery-boy-connect', async (data) => {
    try {
      const { token } = data;
      const deliveryboy = await getBoyDataFromToken(token);
      
      if (deliveryboy) {
        // Store delivery boy socket ID
        await redisClient.setEx(
          `${REDIS_KEYS.DELIVERY_BOY_SOCKET}${deliveryboy._id}`,
          86400,
          socket.id
        );
        
        socket.emit('connection-confirmed', {
          deliveryBoyId: deliveryboy._id,
          name: deliveryboy.name
        });
      }
    } catch (error) {
      console.error('Error handling delivery-boy-connect:', error.message);
    }
  });

  // Handle user disconnect
  socket.on('disconnect', async () => {
    try {
      // Clean up user socket mapping - Updated for Redis client v4+
      const userKeys = await redisClient.keys(`${REDIS_KEYS.USER_SOCKET}*`);
      for (const key of userKeys) {
        const socketId = await redisClient.get(key);
        if (socketId === socket.id) {
          await redisClient.del(key);
        }
      }

      // Clean up delivery boy socket mapping
      const deliveryBoyKeys = await redisClient.keys(`${REDIS_KEYS.DELIVERY_BOY_SOCKET}*`);
      for (const key of deliveryBoyKeys) {
        const socketId = await redisClient.get(key);
        if (socketId === socket.id) {
          await redisClient.del(key);
        }
      }
    } catch (error) {
      console.error('Error handling disconnect cleanup:', error.message);
    }
  });

  // Test endpoint
  socket.emit('test', "Enhanced tracking system initialized");
};

// Helper function to get current delivery location for an order
const getCurrentDeliveryLocation = async (orderId) => {
  try {
    const locationKey = `${REDIS_KEYS.ORDER_TRACKING}${orderId}_location`;
    const locationData = await redisClient.get(locationKey);
    return locationData ? JSON.parse(locationData) : null;
  } catch (error) {
    console.error('Error getting current delivery location:', error);
    return null;
  }
};

// Helper function to update order status
const updateOrderStatus = async (orderId, status) => {
  try {
    const trackingKey = `${REDIS_KEYS.ORDER_TRACKING}${orderId}`;
    const trackingData = await redisClient.get(trackingKey);
    
    if (trackingData) {
      const parsedData = JSON.parse(trackingData);
      parsedData.status = status;
      parsedData.statusUpdatedAt = new Date();
      
      await redisClient.setEx(trackingKey, 86400, JSON.stringify(parsedData));
      
      // Notify user about status change
      const userId = parsedData.userId;
      const userSocketKey = `${REDIS_KEYS.USER_SOCKET}${userId}`;
      const userSocketId = await redisClient.get(userSocketKey);
      
      if (userSocketId && globalIo) {
        globalIo.to(userSocketId).emit('order-status-update', {
          orderId: orderId,
          status: status,
          timestamp: parsedData.statusUpdatedAt
        });
      }
    }
  } catch (error) {
    console.error('Error updating order status:', error);
  }
};

export {
  HandleConnectToAdmin,
  HandleSendOrderToShop,
  HandleAfterAssignDeliveryBoys,
  HandleNotifyToShop,
  HandleTrackOrder,
  getCurrentDeliveryLocation,
  updateOrderStatus
};