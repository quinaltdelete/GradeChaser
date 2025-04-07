require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Define your JWT secret.
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Signup endpoint.
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, email, hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    const newUser = result.rows[0];
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint.
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'SELECT id, username, email, hash FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify the JWT token.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // Attach user info to the request.
    next();
  });
}

// Change Password Endpoint.
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // Obtained from the verified token.
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    // Get the user's current password hash from the database.
    const result = await pool.query('SELECT hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userHash = result.rows[0].hash;
    
    // Compare the provided current password with the stored hash.
    const valid = await bcrypt.compare(currentPassword, userHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    // Hash the new password.
    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the user's password in the database.
    await pool.query('UPDATE users SET hash = $1 WHERE id = $2', [newHash, userId]);
    
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Account Endpoint.
router.delete('/delete-account', authenticateToken, async (req, res) => {
  const userId = req.user.id; // Retrieved from the verified token.
  try {
    // Delete the user from the database.
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;
