require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const INITIAL_RATING = 1000;
const K_FACTOR = 32;

async function calculateEloPersonal(userId) {
  try {
    const votesResult = await pool.query(
      `SELECT easier_route_id, harder_route_id FROM user_votes WHERE user_id = $1;`,
      [userId]
    );
    const votes = votesResult.rows;

    const routeIds = new Set();
    votes.forEach(({ easier_route_id, harder_route_id }) => {
      routeIds.add(easier_route_id);
      routeIds.add(harder_route_id);
    });

    const ratings = {};
    for (const id of routeIds) ratings[id] = INITIAL_RATING;

    for (const { easier_route_id, harder_route_id } of votes) {
      const ratingHarder = ratings[harder_route_id];
      const ratingEasier = ratings[easier_route_id];

      const expectedHarder = 1 / (1 + Math.pow(10, (ratingEasier - ratingHarder) / 400));
      const expectedEasier = 1 / (1 + Math.pow(10, (ratingHarder - ratingEasier) / 400));

      ratings[harder_route_id] = ratingHarder + K_FACTOR * (1 - expectedHarder);
      ratings[easier_route_id] = ratingEasier + K_FACTOR * (0 - expectedEasier);
    }

    return ratings;
  } catch (err) {
    console.error("Error calculating ELO rankings:", err);
    return {};
  } finally {
    pool.end();
  }
}

module.exports = calculateEloPersonal;