require('dotenv').config();
const express = require('express');
const authRoutes = require('./authRoutes');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require("child_process");
const jwt = require('jsonwebtoken');
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "dist")));

const PORT = process.env.PORT || 5001;

// Mount the auth routes.
app.use('/api', authRoutes);

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET || 'supersecret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // Attach the decoded user info (including id) to req.user.
    next();
  });
}

// Sample route to test server
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Get the current username.
app.get("/api/me", authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

// Get the list of ranked routes.
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        area,
        sub_area,
        country,
        COALESCE(certainty_score, 0) AS certainty_score
      FROM routes
      ORDER BY calculated_rank DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching routes:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Get one random route that the current user hasn't compared.
app.get('/api/random-route', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT * FROM routes
       WHERE id NOT IN (
         SELECT DISTINCT easier_route_id FROM user_votes WHERE user_id = $1
         UNION
         SELECT DISTINCT harder_route_id FROM user_votes WHERE user_id = $1
       )
       ORDER BY random() LIMIT 1;`,
       [userId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No routes available" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching random route:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Check for existing comparison between two routes.
app.get('/api/has-comparison', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { routeA, routeB } = req.query;
  try {
    const result = await pool.query(
      `SELECT id FROM user_votes 
       WHERE user_id = $1 
         AND ((easier_route_id = $2 AND harder_route_id = $3) 
           OR (easier_route_id = $3 AND harder_route_id = $2))
       LIMIT 1;`,
      [userId, routeA, routeB]
    );
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error("Error checking comparison:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Add a new route to the database.
app.post('/api/add-route', authenticateToken, async (req, res) => {
  const { name, area, sub_area, country } = req.body;
  const userId = req.user.id; // Retrieved from the token.
  try {
    const result = await pool.query(
      `INSERT INTO routes (name, area, sub_area, country, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE 
       SET area = EXCLUDED.area, 
           sub_area = EXCLUDED.sub_area, 
           country = EXCLUDED.country 
       RETURNING *;`,
      [name, area, sub_area, country, userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error adding route:", error);
    res.status(500).json({ error: "Failed to add route" });
  }
});

// Add a comparison between two routes.
app.post("/api/add-comparison", authenticateToken, async (req, res) => {
  const { newRoute, comparisonRoute, type } = req.body;
  console.log("Received payload:", req.body);
  try {
    // Get the route IDs from the routes table.
    const newRouteResult = await pool.query("SELECT id FROM routes WHERE name = $1;", [newRoute]);
    const comparisonRouteResult = await pool.query("SELECT id FROM routes WHERE name = $1;", [comparisonRoute]);

    if (newRouteResult.rows.length === 0 || comparisonRouteResult.rows.length === 0) {
      return res.status(400).json({ error: "One or both routes do not exist" });
    }

    const newRouteId = newRouteResult.rows[0].id;
    const comparisonRouteId = comparisonRouteResult.rows[0].id;
    // Retrieve the correct user ID from the authenticated token.
    const userId = req.user.id;

    // Insert the relationship.
    if (type === "harder") {
      await pool.query(
        "INSERT INTO route_relationships (harder_route_id, easier_route_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [comparisonRouteId, newRouteId]
      );
    } else {
      await pool.query(
        "INSERT INTO route_relationships (harder_route_id, easier_route_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [newRouteId, comparisonRouteId]
      );
    }    

    // Insert the vote into the user_votes table with the correct user ID.
    await pool.query(
      "INSERT INTO user_votes (user_id, easier_route_id, harder_route_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;",
      [userId, type === "harder" ? newRouteId : comparisonRouteId, type === "harder" ? comparisonRouteId : newRouteId]
    );

    res.json({ message: "Comparison saved successfully" });
  } catch (error) {
    console.error("Error saving comparison:", error);
    res.status(500).json({ error: "Failed to save comparison" });
  }
});

// Get route details and comparisons for the active user.
app.get('/api/route/:id', authenticateToken, async (req, res) => {
  const routeId = req.params.id;
  const userId = req.user.id;
  try {
    const routeResult = await pool.query('SELECT * FROM routes WHERE id = $1;', [routeId]);
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: "Route not found" });
    }
    // Get the compared route name.
    const comparisonsResult = await pool.query(
      `SELECT uv.id,
              CASE 
                WHEN uv.easier_route_id = $2 THEN r_harder.name
                WHEN uv.harder_route_id = $2 THEN r_easier.name
              END AS compared_route,
              CASE 
                WHEN uv.easier_route_id = $2 THEN 'harder'
                WHEN uv.harder_route_id = $2 THEN 'easier'
              END AS type
       FROM user_votes uv
       LEFT JOIN routes r_harder ON uv.harder_route_id = r_harder.id
       LEFT JOIN routes r_easier ON uv.easier_route_id = r_easier.id
       WHERE uv.user_id = $1 
         AND $2 IN (uv.easier_route_id, uv.harder_route_id);`,
      [userId, routeId]
    );
    
    res.json({ route: routeResult.rows[0], comparisons: comparisonsResult.rows });
  } catch (err) {
    console.error("Error fetching route details:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Delete a comparison.
app.delete('/api/delete-comparison/:id', async (req, res) => {
  const comparisonId = req.params.id;
  try {
    const comparisonResult = await pool.query('SELECT easier_route_id, harder_route_id FROM user_votes WHERE id = $1;', [comparisonId]);
    if (comparisonResult.rows.length === 0) {
      return res.status(404).json({ error: "Comparison not found" });
    }
    const { easier_route_id, harder_route_id } = comparisonResult.rows[0];
    await pool.query('DELETE FROM user_votes WHERE id = $1;', [comparisonId]);
    await pool.query(
      'DELETE FROM route_relationships WHERE easier_route_id = $1 AND harder_route_id = $2;',
      [easier_route_id, harder_route_id]
    );
    res.json({ message: "Comparison and relationship deleted" });
  } catch (err) {
    console.error("Error deleting comparison:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Bayesian personal ranking endpoint using a Bradley–Terry model.
app.get('/api/personal-ranking-bayesian', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    // Get all comparisons (votes) made by this user.
    const comparisonsResult = await pool.query(
      `SELECT easier_route_id, harder_route_id
       FROM user_votes
       WHERE user_id = $1;`,
      [userId]
    );
    const comparisons = comparisonsResult.rows;
    
    // Identify all unique route IDs that have been compared.
    const routeIdsSet = new Set();
    comparisons.forEach(comp => {
      routeIdsSet.add(comp.easier_route_id);
      routeIdsSet.add(comp.harder_route_id);
    });
    const routeIds = Array.from(routeIdsSet);
    
    // Initialize log-abilities (gamma) for each route to 0.
    let gamma = {};
    routeIds.forEach(id => {
      gamma[id] = 0;
    });
    
    // Set prior variance parameter.
    const tau2 = 1.0;  // You can tune this value.
    
    // Set up gradient ascent parameters.
    const learningRate = 0.01;
    const maxIter = 1000;
    
    // Perform iterative updates to maximize the log-posterior.
    for (let iter = 0; iter < maxIter; iter++) {
      // Initialize gradients.
      let gradients = {};
      routeIds.forEach(id => {
        gradients[id] = 0;
      });
      
      // For each comparison where route i (harder) wins over route j (easier).
      comparisons.forEach(({ harder_route_id, easier_route_id }) => {
        const i = harder_route_id;
        const j = easier_route_id;
        const exp_i = Math.exp(gamma[i]);
        const exp_j = Math.exp(gamma[j]);
        const p_ij = exp_i / (exp_i + exp_j);
        // For the winner (i), derivative is (1 - p_ij)
        gradients[i] += (1 - p_ij);
        // For the loser (j), derivative is (0 - p_ij) = -p_ij.
        gradients[j] -= p_ij;
      });
      
      // Add the derivative of the log-prior: -gamma_i/tau2 for each route.
      routeIds.forEach(id => {
        gradients[id] -= gamma[id] / tau2;
      });
      
      // Update gamma values and track maximum change for convergence.
      let maxChange = 0;
      routeIds.forEach(id => {
        const change = learningRate * gradients[id];
        gamma[id] += change;
        maxChange = Math.max(maxChange, Math.abs(change));
      });
      
      // Stop if updates are very small.
      if (maxChange < 1e-6) break;
    }
    
    // Transform gamma to a positive score. Here we exponentiate so that higher gamma yields a higher score.
    let scores = {};
    routeIds.forEach(id => {
      scores[id] = Math.exp(gamma[id]);
    });
    
    // Retrieve route details and attach the computed personal score.
    const routesResult = await pool.query(
      'SELECT * FROM routes WHERE id = ANY($1::int[])',
      [routeIds]
    );
    let personalRankings = routesResult.rows.map(route => ({
      ...route,
      personal_score: scores[route.id]
    }));
    
    // Sort the routes by personal_score descending.
    personalRankings.sort((a, b) => b.personal_score - a.personal_score);
    
    res.json(personalRankings);
  } catch (err) {
    console.error("Error calculating Bayesian personal rankings:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Trigger a recalculation of the global rankings.
app.post("/api/recalculate-ranks", async (req, res) => {
  try {
    exec("node server/calculateRanks.js", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running calculateRanks.js: ${error.message}`);
        return res.status(500).json({ error: "Failed to recalculate ranks" });
      }
      if (stderr) {
        console.error(`calculateRanks.js stderr: ${stderr}`);
      }
      console.log(`calculateRanks.js output: ${stdout}`);
      res.json({ message: "Ranks recalculated successfully" });
    });
  } catch (err) {
    console.error("Error triggering rank calculation:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Catch-all route for React Router
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  console.log("Sending index.html from:", indexPath);
  res.sendFile(indexPath);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
