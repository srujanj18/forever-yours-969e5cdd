import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import User from '../models/user';
import CallHistory from '../models/callHistory';

type CallType = 'voice' | 'video';

type ActiveCallSession = {
  callId: string;
  callerId: string;
  receiverId: string;
  callType: CallType;
  startedAt: Date;
  acceptedAt?: Date;
  offerSent?: boolean;
  answerSent?: boolean;
};

export const activeUsers = new Map<string, string>();
const userSockets = new Map<string, Set<string>>();
const socketToUser = new Map<string, string>();
const callSessions = new Map<string, ActiveCallSession>();
const typingUsers = new Map<string, string>();

let io: SocketIOServer;

function getUserRoom(userId: string) {
  return `user-${userId}`;
}

function getSessionKey(userA: string, userB: string) {
  return [userA, userB].sort().join(':');
}

function emitToUser(userId: string, event: string, payload: unknown) {
  io.to(getUserRoom(userId)).emit(event, payload);
}

function isUserOnline(userId: string) {
  return (userSockets.get(userId)?.size || 0) > 0;
}

function getUserIdBySocket(socketId: string) {
  return socketToUser.get(socketId) || '';
}

function registerSocketForUser(userId: string, socketId: string) {
  const sockets = userSockets.get(userId) || new Set<string>();
  sockets.add(socketId);
  userSockets.set(userId, sockets);
  socketToUser.set(socketId, userId);
  activeUsers.set(userId, socketId);
}

function unregisterSocket(socketId: string) {
  const userId = socketToUser.get(socketId);
  if (!userId) return '';

  socketToUser.delete(socketId);
  const sockets = userSockets.get(userId);
  if (!sockets) return userId;

  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    activeUsers.delete(userId);
  } else {
    activeUsers.set(userId, Array.from(sockets)[sockets.size - 1]);
  }

  return userId;
}

async function finalizeCall(session: ActiveCallSession, status: 'completed' | 'missed' | 'rejected') {
  const call = await CallHistory.findById(session.callId);
  if (!call || call.endedAt) return;

  call.endedAt = new Date();
  call.status = status;
  call.duration =
    status === 'completed'
      ? Math.max(0, Math.floor((call.endedAt.getTime() - (session.acceptedAt || session.startedAt).getTime()) / 1000))
      : 0;

  await call.save();
}

export const initializeSocket = (httpServer: HTTPServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5174',
        /^https:\/\/.*\.vercel\.app$/,
      ],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('register-user', async (userId: string) => {
      try {
        registerSocketForUser(userId, socket.id);
        socket.join(getUserRoom(userId));

        const connectionCount = userSockets.get(userId)?.size || 0;
        console.log(`User ${userId} registered on socket ${socket.id} (${connectionCount} connections)`);

        const user = await User.findById(userId).select('partnerId');
        if (!user?.partnerId) return;

        const partnerId = user.partnerId.toString();

        if (isUserOnline(partnerId)) {
          emitToUser(partnerId, 'partner-online', { userId });
          emitToUser(userId, 'partner-online', { userId: partnerId });
        } else {
          emitToUser(userId, 'partner-offline', { userId: partnerId });
        }
      } catch (error) {
        console.error('Error registering user:', error);
      }
    });

    socket.on('initiate-call', async (data: { fromUserId: string; toUserId: string; offer: any; callType?: CallType }) => {
      try {
        if (!isUserOnline(data.toUserId)) {
          socket.emit('call-error', { message: 'User is offline' });
          return;
        }

        const sessionKey = getSessionKey(data.fromUserId, data.toUserId);
        if (callSessions.has(sessionKey)) {
          socket.emit('call-error', { message: 'User is already on a call' });
          return;
        }

        const fromUser = await User.findById(data.fromUserId).select('displayName');
        const callHistory = await CallHistory.create({
          callerId: data.fromUserId,
          receiverId: data.toUserId,
          callType: data.callType || 'video',
          startedAt: new Date(),
          status: 'missed',
        });

        const session: ActiveCallSession = {
          callId: String(callHistory._id),
          callerId: data.fromUserId,
          receiverId: data.toUserId,
          callType: data.callType || 'video',
          startedAt: callHistory.startedAt,
          offerSent: Boolean(data.offer),
          answerSent: false,
        };

        callSessions.set(sessionKey, session);

        emitToUser(data.toUserId, 'incoming-call', {
          fromUserId: data.fromUserId,
          fromUserName: fromUser?.displayName,
          offer: data.offer,
          callType: session.callType,
          callId: session.callId,
        });

        emitToUser(data.fromUserId, 'call-initiated', {
          status: 'waiting',
          callId: session.callId,
          callType: session.callType,
        });
      } catch (error) {
        console.error('Error initiating call:', error);
        socket.emit('call-error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('accept-call', async (data: { fromUserId: string; toUserId: string; answer: any }) => {
      try {
        const session = callSessions.get(getSessionKey(data.fromUserId, data.toUserId));
        if (!session) {
          socket.emit('call-error', { message: 'Call session expired' });
          return;
        }

        session.acceptedAt = new Date();
        session.answerSent = Boolean(data.answer);

        emitToUser(data.fromUserId, 'call-accepted', {
          answer: data.answer,
          acceptedByUserId: data.toUserId,
          callId: session.callId,
          callType: session.callType,
          acceptedAt: session.acceptedAt.toISOString(),
        });

        emitToUser(data.toUserId, 'call-accepted-local', {
          callId: session.callId,
          callType: session.callType,
          acceptedAt: session.acceptedAt.toISOString(),
        });
      } catch (error) {
        console.error('Error accepting call:', error);
        socket.emit('call-error', { message: 'Failed to accept call' });
      }
    });

    socket.on('reject-call', async (data: { fromUserId: string; toUserId: string }) => {
      try {
        const sessionKey = getSessionKey(data.fromUserId, data.toUserId);
        const session = callSessions.get(sessionKey);

        emitToUser(data.fromUserId, 'call-rejected', {
          rejectedByUserId: data.toUserId,
          callId: session?.callId,
        });

        if (session) {
          await finalizeCall(session, 'rejected');
          callSessions.delete(sessionKey);
        }
      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    });

    socket.on('ice-candidate', (data: { candidate: any; toUserId: string }) => {
      try {
        const fromUserId = getUserIdBySocket(socket.id);
        if (!fromUserId) return;

        emitToUser(data.toUserId, 'ice-candidate', {
          candidate: data.candidate,
          fromUserId,
        });
      } catch (error) {
        console.error('Error sending ICE candidate:', error);
      }
    });

    socket.on('send-offer', (data: { toUserId: string; offer: any; callType?: CallType }) => {
      try {
        const fromUserId = getUserIdBySocket(socket.id);
        if (!fromUserId) return;
        const session = callSessions.get(getSessionKey(fromUserId, data.toUserId));
        if (!session || session.offerSent) return;
        session.offerSent = true;

        emitToUser(data.toUserId, 'receive-offer', {
          offer: data.offer,
          fromUserId,
          callType: data.callType,
        });
      } catch (error) {
        console.error('Error sending offer:', error);
      }
    });

    socket.on('send-answer', (data: { toUserId: string; answer: any }) => {
      try {
        const fromUserId = getUserIdBySocket(socket.id);
        if (!fromUserId) return;
        const session = callSessions.get(getSessionKey(fromUserId, data.toUserId));
        if (!session || session.answerSent) return;
        session.answerSent = true;

        emitToUser(data.toUserId, 'receive-answer', {
          answer: data.answer,
          fromUserId,
        });
      } catch (error) {
        console.error('Error sending answer:', error);
      }
    });

    socket.on('end-call', async (data: { fromUserId: string; toUserId: string }) => {
      try {
        const sessionKey = getSessionKey(data.fromUserId, data.toUserId);
        const session = callSessions.get(sessionKey);

        emitToUser(data.toUserId, 'call-ended', {
          endedByUserId: data.fromUserId,
          callId: session?.callId,
        });

        if (session) {
          await finalizeCall(session, session.acceptedAt ? 'completed' : 'missed');
          callSessions.delete(sessionKey);
        }
      } catch (error) {
        console.error('Error ending call:', error);
      }
    });

    socket.on('start-typing', (data: { toUserId: string }) => {
      try {
        const fromUserId = getUserIdBySocket(socket.id);
        if (!fromUserId) return;

        typingUsers.set(fromUserId, data.toUserId);
        emitToUser(data.toUserId, 'partner-typing', { userId: fromUserId });
      } catch (error) {
        console.error('Error handling start-typing:', error);
      }
    });

    socket.on('stop-typing', (data: { toUserId: string }) => {
      try {
        const fromUserId = getUserIdBySocket(socket.id);
        if (!fromUserId) return;

        typingUsers.delete(fromUserId);
        emitToUser(data.toUserId, 'partner-stop-typing', { userId: fromUserId });
      } catch (error) {
        console.error('Error handling stop-typing:', error);
      }
    });

    socket.on('update-activity', (data: { userId: string; isActive: boolean; partnerId: string }) => {
      try {
        emitToUser(data.partnerId, data.isActive ? 'partner-active' : 'partner-inactive', {
          userId: data.userId,
        });
      } catch (error) {
        console.error('Error handling activity update:', error);
      }
    });

    socket.on('disconnect', async () => {
      const disconnectedUserId = unregisterSocket(socket.id);
      if (!disconnectedUserId) return;

      const remainingConnections = userSockets.get(disconnectedUserId)?.size || 0;
      console.log(`Socket ${socket.id} disconnected for user ${disconnectedUserId} (${remainingConnections} remaining)`);

      if (remainingConnections > 0) return;

      try {
        const user = await User.findById(disconnectedUserId).select('partnerId');
        if (user?.partnerId) {
          emitToUser(user.partnerId.toString(), 'partner-offline', { userId: disconnectedUserId });
        }
      } catch (error) {
        console.error('Error notifying partner of offline status:', error);
      }

      const typingPartnerId = typingUsers.get(disconnectedUserId);
      if (typingPartnerId) {
        emitToUser(typingPartnerId, 'partner-stop-typing', { userId: disconnectedUserId });
        typingUsers.delete(disconnectedUserId);
      }

      for (const [sessionKey, session] of callSessions.entries()) {
        if (session.callerId !== disconnectedUserId && session.receiverId !== disconnectedUserId) {
          continue;
        }

        const partnerId = session.callerId === disconnectedUserId ? session.receiverId : session.callerId;
        emitToUser(partnerId, 'call-ended', {
          endedByUserId: disconnectedUserId,
          callId: session.callId,
        });

        await finalizeCall(session, session.acceptedAt ? 'completed' : 'missed');
        callSessions.delete(sessionKey);
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
