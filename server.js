const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;

let mongoConnectionError = null;

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ryezen:Hanzz7308@kasangkatan.2mud2w0.mongodb.net/portfolio';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✓ Connected to MongoDB Atlas');
    mongoConnectionError = null;
    await seedAdmin();
  })
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err);
    mongoConnectionError = err.message || err.toString();
  });

// Seed admin user function
async function seedAdmin() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await Admin.findOne({ username: adminUsername });
    if (existingAdmin) {
      console.log('✓ Admin already exists');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const newAdmin = new Admin({
      username: adminUsername,
      password: hashedPassword,
      createdAt: new Date()
    });

    await newAdmin.save();
    console.log('✓ Admin seeded');
  } catch (error) {
    console.error('✗ Failed to seed admin:', error);
  }
}

// Global Middlewares
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Uploads Directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const projectRoutes = require('./routes/projects');
const userProjectRoutes = require('./routes/userProjects');
const adminRoutes = require('./routes/admin');

// Database connection status check middleware
app.use('/api', (req, res, next) => {
  if (mongoConnectionError) {
    return res.status(503).json({
      message: `Database connection error: ${mongoConnectionError}. Please check if your MongoDB Atlas database is active and IP Access List allows connections from anywhere (add 0.0.0.0/0).`
    });
  }
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/user/projects', userProjectRoutes);
app.use('/api/admin', adminRoutes);

// Fallback path routes for clean client-side routing if requested
app.get('*', (req, res, next) => {
  // If requesting an API, pass to route handlers (they should handle 404 themselves)
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Otherwise, fallback to public static page
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong on the server.' });
});

// Export app for serverless deployment
module.exports = app;

// Start Server only if run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
  });
}

