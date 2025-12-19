import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import User from '../models/user';
import CallHistory from '../models/callHistory';

// Store active users and their socket IDs
export const activeUsers = new Map<string, string>(); // userId -> socketId
const userConnectionCount = new Map<string, number>(); // userId -> connection count
const callInProgress = new Map<string, string>(); // userId -> partnerId
const typingUsers = new Map<string, string>(); // userId -> partnerId (who they're typing to)

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5174', // Vite dev server
        /^https:\/\/.*\.vercel\.app$/, // Vercel deployments
      ],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Register user
    socket.on('register-user', async (userId: string) => {
      try {
        // Track connection count
        const currentCount = userConnectionCount.get(userId) || 0;
        userConnectionCount.set(userId, currentCount + 1);

        activeUsers.set(userId, socket.id);
        socket.join(`user-${userId}`);
        console.log(`👤 User ${userId} registered with socket ${socket.id} (connection count: ${userConnectionCount.get(userId)})`);

        // Notify partner if they're online
        const user = await User.findById(userId).select('partnerId');
        if (user?.partnerId) {
          const partnerId = user.partnerId.toString();
          const partnerSocketId = activeUsers.get(partnerId);

          // Notify partner that this user is online
          if (partnerSocketId) {
            io.to(partnerSocketId).emit('partner-online', { userId });
            console.log(`📡 Notified partner ${partnerId} that user ${userId} is online`);
          }

          // Also notify this user if their partner is online
          if (activeUsers.has(partnerId)) {
            io.to(socket.id).emit('partner-online', { userId: partnerId });
            console.log(`📡 Notified user ${userId} that partner ${partnerId} is online`);
          } else {
            // If partner is not online, explicitly notify that they're offline
            io.to(socket.id).emit('partner-offline', { userId: partnerId });
            console.log(`📡 Notified user ${userId} that partner ${partnerId} is offline`);
          }
        }
      } catch (error) {
        console.error('Error registering user:', error);
      }
    });

    // Initiate call (video or voice)
    socket.on('initiate-call', async (data: { fromUserId: string; toUserId: string; offer: any; callType?: 'voice' | 'video' }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);

        if (!toUserSocketId) {
          socket.emit('call-error', { message: 'User is offline' });
          return;
        }

        // Check if partner is already in a call
        if (callInProgress.has(data.toUserId)) {
          socket.emit('call-error', { message: 'User is already on a call' });
          return;
        }

        const fromUser = await User.findById(data.fromUserId).select('displayName email');

        // Create call history entry
        const callHistory = new CallHistory({
          callerId: data.fromUserId,
          receiverId: data.toUserId,
          callType: data.callType || 'video',
          startedAt: new Date(),
        });
        await callHistory.save();

        // Send call notification to the other user
        io.to(toUserSocketId).emit('incoming-call', {
          fromUserId: data.fromUserId,
          fromUserName: fromUser?.displayName,
          offer: data.offer,
          callType: data.callType || 'video', // Default to video for backward compatibility
          callId: callHistory._id, // Include call ID for tracking
        });

        // Mark call as in progress
        callInProgress.set(data.fromUserId, data.toUserId);
        callInProgress.set(data.toUserId, data.fromUserId);

        socket.emit('call-initiated', { status: 'waiting', callId: callHistory._id });
        console.log(`📞 ${data.callType || 'video'} call initiated from ${data.fromUserId} to ${data.toUserId}`);
      } catch (error) {
        console.error('Error initiating call:', error);
        socket.emit('call-error', { message: 'Failed to initiate call' });
      }
    });

    // Accept call
    socket.on('accept-call', async (data: { fromUserId: string; toUserId: string; answer: any }) => {
      try {
        const toUserSocketId = activeUsers.get(data.fromUserId);
        
        if (!toUserSocketId) {
          socket.emit('call-error', { message: 'Caller is offline' });
          return;
        }

        // Notify the caller that call was accepted
        io.to(toUserSocketId).emit('call-accepted', {
          answer: data.answer,
          acceptedByUserId: data.toUserId,
        });

        console.log(`✅ Call accepted by ${data.toUserId}`);
      } catch (error) {
        console.error('Error accepting call:', error);
        socket.emit('call-error', { message: 'Failed to accept call' });
      }
    });

    // Reject call
    socket.on('reject-call', async (data: { fromUserId: string; toUserId: string }) => {
      try {
        const fromUserSocketId = activeUsers.get(data.fromUserId);
        
        if (fromUserSocketId) {
          io.to(fromUserSocketId).emit('call-rejected', {
            rejectedByUserId: data.toUserId,
          });
        }

        // Update call history status to rejected
        try {
          const call = await CallHistory.findOne({
            $or: [
              { callerId: data.fromUserId, receiverId: data.toUserId },
              { callerId: data.toUserId, receiverId: data.fromUserId },
            ],
          }).sort({ startedAt: -1 });

          if (call && !call.endedAt) {
            call.status = 'rejected';
            call.endedAt = new Date();
            call.duration = 0;
            await call.save();
          }
        } catch (historyErr) {
          console.error('Failed to update rejected call history:', historyErr);
        }

        // Clear call progress
        callInProgress.delete(data.fromUserId);
        callInProgress.delete(data.toUserId);

        console.log(`❌ Call rejected by ${data.toUserId}`);
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data: { candidate: any; toUserId: string }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        if (toUserSocketId) {
          // Get sender's user ID from active users map
          let fromUserId = '';
          for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
              fromUserId = userId;
              break;
            }
          }
          io.to(toUserSocketId).emit('ice-candidate', {
            candidate: data.candidate,
            fromUserId,
          });
        }
      } catch (error) {
        console.error('Error sending ICE candidate:', error);
      }
    });

    // Handle offer/answer exchange
    socket.on('send-offer', (data: { toUserId: string; offer: any }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        if (toUserSocketId) {
          // Get sender's user ID from active users map
          let fromUserId = '';
          for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
              fromUserId = userId;
              break;
            }
          }
          io.to(toUserSocketId).emit('receive-offer', {
            offer: data.offer,
            fromUserId,
          });
        }
      } catch (error) {
        console.error('Error sending offer:', error);
      }
    });

    socket.on('send-answer', (data: { toUserId: string; answer: any }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        if (toUserSocketId) {
          // Get sender's user ID from active users map
          let fromUserId = '';
          for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
              fromUserId = userId;
              break;
            }
          }
          io.to(toUserSocketId).emit('receive-answer', {
            answer: data.answer,
            fromUserId,
          });
        }
      } catch (error) {
        console.error('Error sending answer:', error);
      }
    });

    // End call
    socket.on('end-call', async (data: { fromUserId: string; toUserId: string }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        
        if (toUserSocketId) {
          io.to(toUserSocketId).emit('call-ended', {
            endedByUserId: data.fromUserId,
          });
        }

        // Update call history with endedAt and duration
        try {
          const call = await CallHistory.findOne({
            $or: [
              { callerId: data.fromUserId, receiverId: data.toUserId },
              { callerId: data.toUserId, receiverId: data.fromUserId },
            ],
          }).sort({ startedAt: -1 });

          if (call && !call.endedAt) {
            call.endedAt = new Date();
            const durationSeconds = Math.max(0, Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000));
            call.duration = durationSeconds;
            call.status = 'completed';
            await call.save();
          }
        } catch (historyErr) {
          console.error('Failed to update completed call history:', historyErr);
        }

        // Clear call progress
        callInProgress.delete(data.fromUserId);
        callInProgress.delete(data.toUserId);

        console.log(`📴 Call ended between ${data.fromUserId} and ${data.toUserId}`);
      } catch (error) {
        console.error('Error ending call:', error);
      }
    });

    // Handle typing events
    socket.on('start-typing', async (data: { toUserId: string }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        if (toUserSocketId) {
          // Get sender's user ID from active users map
          let fromUserId = '';
          for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
              fromUserId = userId;
              break;
            }
          }
          // Track typing user
          typingUsers.set(fromUserId, data.toUserId);
          io.to(toUserSocketId).emit('partner-typing', { userId: fromUserId });
          console.log(`⌨️ User ${fromUserId} started typing to ${data.toUserId}`);
        }
      } catch (error) {
        console.error('Error handling start-typing:', error);
      }
    });

    socket.on('stop-typing', async (data: { toUserId: string }) => {
      try {
        const toUserSocketId = activeUsers.get(data.toUserId);
        if (toUserSocketId) {
          // Get sender's user ID from active users map
          let fromUserId = '';
          for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
              fromUserId = userId;
              break;
            }
          }
          // Remove from typing users
          typingUsers.delete(fromUserId);
          io.to(toUserSocketId).emit('partner-stop-typing', { userId: fromUserId });
          console.log(`⌨️ User ${fromUserId} stopped typing to ${data.toUserId}`);
        }
      } catch (error) {
        console.error('Error handling stop-typing:', error);
      }
    });

    // Handle activity status updates
    socket.on('update-activity', async (data: { userId: string; isActive: boolean; partnerId: string }) => {
      try {
        const partnerSocketId = activeUsers.get(data.partnerId);
        if (partnerSocketId) {
          if (data.isActive) {
            io.to(partnerSocketId).emit('partner-active', { userId: data.userId });
            console.log(`📡 Notified partner ${data.partnerId} that user ${data.userId} is active`);
          } else {
            io.to(partnerSocketId).emit('partner-inactive', { userId: data.userId });
            console.log(`📡 Notified partner ${data.partnerId} that user ${data.userId} is inactive`);
          }
        }
      } catch (error) {
        console.error('Error handling activity update:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      let disconnectedUserId = '';

      // Find the user from active users
      for (const [userId, socketId] of activeUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          break;
        }
      }

      if (disconnectedUserId) {
        // Decrement connection count
        const currentCount = userConnectionCount.get(disconnectedUserId) || 0;
        const newCount = Math.max(0, currentCount - 1);
        userConnectionCount.set(disconnectedUserId, newCount);

        console.log(`🔌 Socket ${socket.id} disconnected for user ${disconnectedUserId} (remaining connections: ${newCount})`);

        // If no connections remain, immediately notify offline and cleanup
        if (newCount === 0) {
          // Immediately notify partner that user went offline
          try {
            const user = await User.findById(disconnectedUserId).select('partnerId');
            if (user?.partnerId) {
              const partnerSocketId = activeUsers.get(user.partnerId.toString());
              if (partnerSocketId) {
                io.to(partnerSocketId).emit('partner-offline', { userId: disconnectedUserId });
                console.log(`📡 Notified partner ${user.partnerId} that user ${disconnectedUserId} is offline`);
              }
            }
          } catch (error) {
            console.error('Error notifying partner of offline status:', error);
          }

          // Remove from active users immediately
          activeUsers.delete(disconnectedUserId);

          // Clear typing status
          const typingPartnerId = typingUsers.get(disconnectedUserId);
          if (typingPartnerId) {
            const partnerSocketId = activeUsers.get(typingPartnerId);
            if (partnerSocketId) {
              io.to(partnerSocketId).emit('partner-stop-typing', { userId: disconnectedUserId });
              console.log(`⌨️ Cleared typing status for disconnected user ${disconnectedUserId}`);
            }
            typingUsers.delete(disconnectedUserId);
          }

          // End any active calls
          const partnerId = callInProgress.get(disconnectedUserId);
          if (partnerId) {
            const partnerSocketId = activeUsers.get(partnerId);
            if (partnerSocketId) {
              io.to(partnerSocketId).emit('call-ended', {
                endedByUserId: disconnectedUserId,
              });
            }
            // Update call history for disconnect scenario
            try {
              const call = await CallHistory.findOne({
                $or: [
                  { callerId: disconnectedUserId, receiverId: partnerId },
                  { callerId: partnerId, receiverId: disconnectedUserId },
                ],
              }).sort({ startedAt: -1 });

              if (call && !call.endedAt) {
                call.endedAt = new Date();
                const durationSeconds = Math.max(0, Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000));
                call.duration = durationSeconds;
                call.status = 'completed';
                await call.save();
              }
            } catch (historyErr) {
              console.error('Failed to update call history on disconnect:', historyErr);
            }

            callInProgress.delete(disconnectedUserId);
            callInProgress.delete(partnerId);
          }

          console.log(`📴 User ${disconnectedUserId} marked offline immediately`);
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};
