
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { connectDB } from './config/db';
import { initializeEmailService } from './services/emailService';
import { initializeSocket } from './services/socketService';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';
import momentRoutes from './routes/moments';
import galleryRoutes from './routes/gallery';
import callRoutes from './routes/calls';
import goalRoutes from './routes/goals';
import { errorHandler } from './middleware/error';
import { securityHeaders, requestLogger, csrfProtection } from './middleware/security';
import { initFirebase } from './config/firebase';

dotenv.config();
initFirebase();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
initializeSocket(httpServer);

// Security middleware
app.use(securityHeaders);
app.use(requestLogger);
app.use(csrfProtection);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5174', // Vite dev server
      /^https:\/\/.*\.vercel\.app$/, // Vercel deployments
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      }
      return allowedOrigin.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API Routes
app.get('/api', (req, res) => {
  res.send('Welcome to the Forever Yours API! ❤️');
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/moments', momentRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/goals', goalRoutes);

// Error Handling
app.use(errorHandler);

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    await initializeEmailService();
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`✅ Socket.io server initialized`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

