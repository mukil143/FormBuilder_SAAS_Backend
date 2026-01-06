import cors from 'cors';
import express from 'express';

// Middleware
import { globalLimiter } from './src/Middleware/rateLimitMiddleware.js';

// Route Imports
import AdminReport from './src/AdminRoutes/adminReport.js';
import AdminUser from './src/AdminRoutes/adminUser.js';
import form from './src/Dashboard/form.js';
import masterFields from './src/Dashboard/masterFields.js';
import userReport from './src/Dashboard/userReport.js';
import users from './src/UserRoutes/user.js';
import publicRoutes from './src/publicRoutes/public.js';

// Initialize App
const app = express();
const PORT = 7001;

// Global Middleware Config
app.use(cors());              // Enable CORS
app.use(express.json());      // Parse JSON body
app.use(globalLimiter);       // Rate Limiting

// Test Route
app.get('/api/test', (req, res) => {
    res.json({
        message: "API is working fine!"
    });
});

// Route Mounting
app.use('/', masterFields);
app.use('/', form);
app.use('/', users);
app.use('/', publicRoutes);
app.use('/', userReport);
app.use('/', AdminReport);
app.use('/', AdminUser);

// Server Start
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}`);
});
