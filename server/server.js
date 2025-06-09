require('dotenv').config();
const express = require('express');
const authRoutes = require('./authRoutes');
const cors = require('cors');
const { Pool } = require('pg');
const { exec } = require("child_process");
const jwt = require('jsonwebtoken');
const path = require("path");
const calculateEloPersonal = require('./calculateEloPersonal');
const { spawn } = require("child_process");

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

// Get the list of ranked routes with number of comparisons.
app.get('/api/routes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.area,
        r.sub_area,
        r.country,
        r.book_grade,
        r.estimated_v_grade,
        COALESCE(r.certainty_score, 0) AS certainty_score,
        COALESCE(c.num_comparisons, 0) AS num_comparisons,
        COALESCE(c.num_comparisons, 0) > 0 AS has_comparisons
      FROM routes r
      LEFT JOIN (
        SELECT route_id, COUNT(*) AS num_comparisons
        FROM (
          SELECT easier_route_id AS route_id FROM route_relationships
          UNION ALL
          SELECT harder_route_id AS route_id FROM route_relationships
        ) AS combined
        GROUP BY route_id
      ) c ON r.id = c.route_id
      ORDER BY r.calculated_rank DESC;
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
      [
        userId,
        type === "harder" ? newRouteId : comparisonRouteId,
        type === "harder" ? comparisonRouteId : newRouteId
      ]
    );

    // Check how many total comparisons exist in the route_relationships table. If it's a multiple of 50, run the script.
    const totalResult = await pool.query("SELECT COUNT(*) FROM route_relationships;");
    const totalComparisons = parseInt(totalResult.rows[0].count, 10);
    console.log("Total comparisons so far:", totalComparisons);

    // Only batch-recalculate if we've hit a multiple of 10
    if (totalComparisons > 0 && totalComparisons % 10 === 0) {
      try {
        exec("node server/calculateRanks.js", (error, stdout, stderr) => {
          if (error) {
            console.error("Error running calculateRanks.js:", error);
          } else {
            console.log("Recalculated ranks after hitting 10-comparison milestone.");
          }
          if (stderr) {
            console.error("calculateRanks stderr:", stderr);
          }
          console.log("calculateRanks output:", stdout);
        });
      } catch (err) {
        console.error("Error triggering rank calculation:", err);
      }
    }

    // Respond to the client right away (we're not awaiting the script).
    return res.json({ message: "Comparison saved successfully" });

  } catch (error) {
    console.error("Error saving comparison:", error);
    return res.status(500).json({ error: "Failed to save comparison" });
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

app.get('/api/personal-ranking', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const eloScores = await calculateEloPersonal(userId);
    const routeIds = Object.keys(eloScores).map(id => parseInt(id));

    const routesResult = await pool.query(
      'SELECT * FROM routes WHERE id = ANY($1::int[])',
      [routeIds]
    );

    const rankedRoutes = routesResult.rows.map(route => ({
      ...route,
      personal_score: eloScores[route.id],
      has_comparisons: true      
    }));

    rankedRoutes.sort((a, b) => b.personal_score - a.personal_score);
    res.json(rankedRoutes);
  } catch (err) {
    console.error("Error fetching Elo personal ranking:", err);
    res.status(500).json({ error: "Failed to compute personal ranking" });
  }
});

// Trigger a recalculation of the global rankings.
app.post("/api/recalculate-ranks", async (req, res) => {
  res.status(202).json({ message: "Re-calculation started" });

  // Kick off the calculate ranks task after the response is flushed.
  const child = spawn("node", ["server/calculateRanks.js"], {
    stdio: ["ignore", "inherit", "inherit"], 
    detached: true                          
  });

  // Detach so the parent (web server) isn’t blocked
  child.unref();

  child.on("error",  err  => console.error("Rank script error:", err));
  child.on("close", code => console.log(`Rank script finished with code ${code}`));
});

// Get specific user stats.
app.get('/api/user-stats', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // All route IDs the user has ranked
    const { rows: rankedRows } = await pool.query(
      `
      SELECT DISTINCT route_id FROM (
        SELECT easier_route_id AS route_id FROM user_votes WHERE user_id = $1
        UNION
        SELECT harder_route_id AS route_id FROM user_votes WHERE user_id = $1
      ) AS user_ranked
      `,
      [userId]
    );
    const userRouteIds = rankedRows.map(r => r.route_id);
    const numRanked = userRouteIds.length;

    let hardestRoute = null;

    if (numRanked > 0) {
      // Get all routes in global order
      const allRoutesResult = await pool.query(
        `SELECT id, name, calculated_score, calculated_rank FROM routes ORDER BY calculated_rank DESC`
        // Or: `ORDER BY calculated_score DESC` if you don't have calculated_rank
      );
      const allRoutes = allRoutesResult.rows;

      // Find the highest-ranked route the user has ranked
      const userRoutesInOrder = allRoutes.filter(r => userRouteIds.includes(r.id));
      if (userRoutesInOrder.length > 0) {
        const hardest = userRoutesInOrder[0]; // first in global order
        const globalRank = allRoutes.findIndex(r => r.id === hardest.id) + 1;
        hardestRoute = {
          name: hardest.name,
          score: hardest.calculated_score,
          rank: globalRank
        };
      }
    }

    res.json({
      numRanked,
      hardestRoute // null if none
    });
  } catch (err) {
    console.error("Error in /api/user-stats:", err);
    res.status(500).json({ error: "Failed to fetch user stats." });
  }
});

// Catch-all route for React Router
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  console.log("Sending index.html from:", indexPath);
  res.sendFile(indexPath);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
