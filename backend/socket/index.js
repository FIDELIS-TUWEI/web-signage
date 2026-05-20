const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('../utils/config');
const Display = require('../models/display.model');
const logger = require('../utils/logger');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow server-side / non-browser clients (no Origin header)
        if (!origin || config.ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Socket CORS: origin "${origin}" not allowed`));
        }
      },
      credentials: true,
    },
    // Start with polling so the connection works even behind proxies that
    // don't support WebSocket upgrades (e.g. Render free tier).
    transports: ['polling', 'websocket'],
  });

  // Admin/editor namespace — authenticated via JWT cookie
  const adminNs = io.of('/admin');

  adminNs.use((socket, next) => {
    try {
      // Accept JWT from auth handshake (browser socket.io client) or HttpOnly cookie (SSR)
      const cookieToken = cookie.parse(socket.handshake.headers.cookie || '').jwt;
      const token = socket.handshake.auth?.token || cookieToken;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  adminNs.on('connection', (socket) => {
    logger.info(`Admin connected: ${socket.id}`);
    socket.join('admin');

    socket.on('disconnect', () => {
      logger.debug(`Admin disconnected: ${socket.id}`);
    });
  });

  // Display namespace — authenticated via deviceKey
  const displayNs = io.of('/display');

  displayNs.use(async (socket, next) => {
    try {
      const deviceKey = socket.handshake.auth?.deviceKey;
      if (!deviceKey) return next(new Error('Device key required'));

      const display = await Display.findOne({ deviceKey, isActive: true })
        .select('_id name')
        .lean();

      if (!display) return next(new Error('Invalid device key'));

      socket.displayId = display._id.toString();
      socket.displayName = display.name;
      next();
    } catch (err) {
      next(new Error('Auth error'));
    }
  });

  displayNs.on('connection', async (socket) => {
    const { displayId, displayName } = socket;
    logger.info(`Display connected: ${displayName} (${displayId})`);

    socket.join(`display:${displayId}`);

    await Display.findByIdAndUpdate(displayId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    // Admin dashboard notified that screen came online
    adminNs.to('admin').emit('display:online', { displayId, displayName });

    socket.on('display:heartbeat', async () => {
      await Display.findByIdAndUpdate(displayId, { lastSeen: new Date() });
    });

    socket.on('disconnect', async () => {
      logger.debug(`Display disconnected: ${displayName}`);
      await Display.findByIdAndUpdate(displayId, { isOnline: false });
      adminNs.to('admin').emit('display:offline', { displayId, displayName });
    });
  });

  logger.success('Socket.IO initialised');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialised');
  return io;
};

// Convenience emitters used by controllers and jobs
const emitToDisplay = (displayId, event, data) => {
  getIO().of('/display').to(`display:${displayId}`).emit(event, data);
};

const emitToAdmin = (event, data) => {
  getIO().of('/admin').to('admin').emit(event, data);
};

const emitToAll = (event, data) => {
  getIO().of('/display').emit(event, data);
  emitToAdmin(event, data);
};

module.exports = { initSocket, getIO, emitToDisplay, emitToAdmin, emitToAll };
