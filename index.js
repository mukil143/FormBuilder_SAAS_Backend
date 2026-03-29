import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 resolution to avoid potential issues with some libraries
import express from 'express';
import cors from 'cors';

//Razorpay Webhook Controller
import { handleRazorpayWebhook } from './src/controllers/webhookController.js';

//Subscription  routes
import subscriptionRoutes from './src/Dashboard/subscriptions.js';

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
import  externalApiRoutes from './src/v1/externalApiRoutes.js';
import { startCronJobs } from './src/cron/resetUsage.js';
// Initialize App
const app = express();
const PORT = 7001;

app.post('/api/webhook/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook); // Razorpay Webhook Route
// Global Middleware Config
app.use(cors());              // Enable CORS
app.use(express.json());      // Parse JSON body
app.use(globalLimiter);       // Rate Limiting

// Test Route
app.get('/', (req, res) => {
    res.json({
        message: "API is running successfully",
        status: "success",
        code: 200

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
app.use('/', subscriptionRoutes); // Subscription Routes

//External API Routes
app.use('/api/v1', externalApiRoutes);



startCronJobs();

// Server Start
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 API Base URL: http://localhost:${PORT}`);
});
