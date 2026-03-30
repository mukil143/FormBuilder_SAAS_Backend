import rateLimit from 'express-rate-limit'


// 1. General Limiter (Applied to all routes)
// Prevents simple DDoS attacks
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 2. Auth Limiter (Stricter!)
// Protects Login/Register from brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per 15 mins
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes."
  }
});

// 3. Form Submission Limiter
// Prevents spam bots from filling your database
export const formSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 submissions per hour per IP
  message: {
    success: false,
    message: "You have submitted too many forms. Please wait a while."
  }
});
