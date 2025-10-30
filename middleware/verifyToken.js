// Import the JSON Web Token (JWT) library for verifying tokens
const jwt = require('jsonwebtoken')

// Import your database models (Guest and Staff)
const Guest = require('../models/guest')
const Staff = require('../models/staff')

// Authentication middleware to protect routes
const auth = async (req, res, next) => {
  try {
    // Get the 'Authorization' header from the request
    const authHeader = req.header('Authorization')

    // If the header starts with "Bearer ", remove it and extract only the token.
    // Otherwise, check for an 'x-auth-token' header (some clients use that instead).
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.header('x-auth-token')

    // If there’s no token at all, deny access.
    if (!token) {
      return res.status(401).json({ status: 'error', msg: 'No token provided' })
    }

    // Get the "From" header (this tells us who is making the request)
    // Example: From: guest  OR  From: staff
    const from = req.header('From')

    // If the 'From' header is missing, reject the request
    if (!from) {
      return res.status(401).json({ status: 'error', msg: 'From header must be set (guest/staff)' })
    }

    // Verify the token using your secret key from the .env file
    // This decodes the token and gives access to the payload (e.g., the user's ID)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Store the token on the request object (optional but useful later)
    req.token = token;

    // ==============================
    // 👇🏽 CASE 1: If the request came from a guest
    // ==============================
    if (from === 'guest') {
      // Find the guest in the database using the decoded ID
      const guest = await Guest.findById(decoded._id).lean()

      // If no guest matches that token, deny access
      if (!guest) return res.status(401).json({ status: 'error', msg: 'Guest not found' })

      // Attach guest info and role ("guest") to the request
      req.user = { ...guest, from: 'guest' }

      // Continue to the next middleware or route
      next()
    } 

    // ==============================
    // 👇🏽 CASE 2: If the request came from a staff member
    // ==============================
    else if (from === 'staff') {
      // Find the staff in the database using the decoded ID
      const staff = await Staff.findById(decoded._id).lean()

      // If no staff found, deny access
      if (!staff) return res.status(401).json({ status: 'error', msg: 'Staff not found' })

      // If staff account is blocked or deleted, deny access
      if (staff.isBlocked || staff.isDeleted)
        return res.status(403).json({ status: 'error', msg: 'Staff account blocked or deleted' })

      // Attach staff info and role ("staff") to the request
      req.user = { ...staff, from: 'staff' }

      // Continue to the next middleware or route
      next()
    } 

    // ==============================
    // 👇🏽 CASE 3: Invalid "From" header value
    // ==============================
    else {
      return res.status(400).json({ status: 'error', msg: 'Invalid From header value' })
    }
  } 
  catch (error) {
    // If token is expired, handle it clearly
    if (error.name === 'TokenExpiredError')
      return res.status(401).json({ status: 'error', msg: 'Token expired' })

    // If token is invalid or malformed
    if (error.name === 'JsonWebTokenError')
      return res.status(401).json({ status: 'error', msg: 'Invalid token' })

    // If some unexpected server error occurs
    console.error('Auth middleware error:', error)
    res.status(500).json({ status: 'error', msg: 'Server error during authentication' })
  }
}

// Export the middleware so you can use it in your routes
module.exports = auth
