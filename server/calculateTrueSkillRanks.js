require('dotenv').config();
const { Pool } = require('pg');
const trueskill = require('trueskill');

// Create a PostgreSQL pool.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Define a default rating using TrueSkill's default.
const defaultRating = new trueskill.Rating();

async function calculateTrueSkillRanks() {
  try {
    console.log("Fetching data for TrueSkill ranking...");

    // Get all routes.
    const routesResult = await pool.query("SELECT id FROM routes;");
    const routeIds = routesResult.rows.map(row => row.id);

    // Initialize ratings for all routes with the default rating.
    let ratings = {};
    routeIds.forEach(id => {
      ratings[id] = defaultRating; // All routes start with default rating.
    });

    // Get all comparisons from the route_relationships table.
    const edgesResult = await pool.query(`
      SELECT harder_route_id, easier_route_id, weight
      FROM route_relationships;
    `);
    const comparisons = edgesResult.rows;

    console.log(`Processing ${comparisons.length} comparisons using TrueSkill...`);

    // For each comparison, update the ratings.
    // Treat a comparison where route A is harder than route B as a match where A wins.
    comparisons.forEach(({ harder_route_id, easier_route_id, weight }) => {
      // Apply the comparison 'weight' times.
      for (let i = 0; i < weight; i++) {
        // Use trueskill.rate to update the ratings.
        // The API expects an array of teams, each team being an array of ratings.
        // Here, [0,1] indicates that the first team (harder route) wins.
        const [newHarder, newEasier] = trueskill.rate(
          [[ratings[harder_route_id]], [ratings[easier_route_id]]],
          [0, 1]
        );
        ratings[harder_route_id] = newHarder[0];
        ratings[easier_route_id] = newEasier[0];
      }
    });

    // Update the calculated_rank in the database using the rating mean (mu).
    for (const id of routeIds) {
      const rating = ratings[id];
      const newRank = rating.mu;  // Using mu as the ranking value.
      await pool.query("UPDATE routes SET calculated_rank = $1 WHERE id = $2;", [newRank, id]);
    }

    console.log("TrueSkill ranking calculation complete!");

  } catch (err) {
    console.error("Error calculating TrueSkill ranks:", err);
  } finally {
    pool.end();
  }
}

calculateTrueSkillRanks();
