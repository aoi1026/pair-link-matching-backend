const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.userId})`);

    await User.findByIdAndUpdate(socket.userId, {
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date()
    });

    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      name: socket.user.name,
      location: socket.user.location,
      profilePhoto: socket.user.profilePhoto
    });

    socket.on('updateLocation', async (data) => {
      try {
        const { lat, lng } = data;
        
        const updatedUser = await User.findByIdAndUpdate(
          socket.userId,
          {
            location: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            lastSeen: new Date()
          },
          { new: true }
        );

        socket.broadcast.emit('userLocationUpdate', {
          userId: socket.userId,
          location: updatedUser.location,
          timestamp: new Date()
        });

        socket.emit('locationUpdated', {
          success: true,
          location: updatedUser.location
        });
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    socket.on('joinRoom', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.user.name} joined room: ${roomId}`);
    });

    socket.on('leaveRoom', (roomId) => {
      socket.leave(roomId);
      console.log(`User ${socket.user.name} left room: ${roomId}`);
    });

    socket.on('sendMessage', (data) => {
      const { roomId, message, targetUserId } = data;
      
      socket.to(roomId).emit('newMessage', {
        senderId: socket.userId,
        senderName: socket.user.name,
        message,
        timestamp: new Date()
      });
    });

    socket.on('approachingMeeting', (data) => {
      const { matchId, targetUserId, distance } = data;
      
      io.emit('userApproachingMeeting', {
        matchId,
        userId: socket.userId,
        userName: socket.user.name,
        distance,
        timestamp: new Date()
      });
    });

    socket.on('requestLocationShare', (targetUserId) => {
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('locationShareRequest', {
          requesterId: socket.userId,
          requesterName: socket.user.name
        });
      }
    });

    socket.on('shareLocation', (data) => {
      const { targetUserId, location, duration = 300000 } = data;
      
      const targetSocket = [...io.sockets.sockets.values()]
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('locationShared', {
          senderId: socket.userId,
          senderName: socket.user.name,
          location,
          expiresAt: new Date(Date.now() + duration)
        });

        setTimeout(() => {
          targetSocket.emit('locationShareExpired', {
            senderId: socket.userId
          });
        }, duration);
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.userId})`);
      
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: null
      });

      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        lastSeen: new Date()
      });
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  const pingInterval = setInterval(() => {
    io.emit('ping', { timestamp: new Date() });
  }, 30000);

  io.on('close', () => {
    clearInterval(pingInterval);
  });
};

module.exports = socketHandler;