import express from 'express'
import cors from 'cors'
const app = express();
import masterFields from './src/Dashboard/masterFields.js'
import form from './src/Dashboard/form.js'
import users from './src/UserRoutes/user.js'
import publicRoutes from './src/Dashboard/public.js'

app.use(cors());              // Enable CORS
app.use(express.json());      // Parse JSON body

// Test Route
app.get('/api/test', (req, res) => {
    res.json({
        message: "API is working fine!"
    });
});

app.use('/',masterFields)
app.use('/',form)
app.use('/',users)
app.use('/',publicRoutes)



// Server
app.listen(7001, () => {
    console.log("🚀 Server is running on port 7001");
    console.log("🌐 API Base URL: http://localhost:7001");
});
