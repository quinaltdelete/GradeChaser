require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

const ITERATIONS = 200;
const INITIAL_SCORE = 1000;

async function calculateBradleyTerryRanks() {
  try {
    console.log("Fetching data...");

    const routesResult = await pool.query("SELECT id FROM routes;");
    const routes = routesResult.rows.map(row => row.id);

    let strengths = {};
    routes.forEach(id => strengths[id] = INITIAL_SCORE);

    const edgesResult = await pool.query(`
      SELECT harder_route_id, easier_route_id, weight
      FROM route_relationships;
    `);
    const comparisons = edgesResult.rows;

    // Build adjacency for each route
    let adjacency = {};
    routes.forEach((routeId) => {
      adjacency[routeId] = new Set();
    });

    for (const { harder_route_id, easier_route_id } of comparisons) {
      // Add an edge from the harder route to the easier route
      adjacency[harder_route_id].add(easier_route_id);
    }
    
    // Build the reversed adjacency as well (easier → harder)
    let adjacencyReversed = {};
    routes.forEach((id) => {
      adjacencyReversed[id] = new Set();
    });
    for (const { harder_route_id, easier_route_id } of comparisons) {
      adjacencyReversed[easier_route_id].add(harder_route_id);
    }
    
    // -- STEP 3: For each route, run BFS to find all descendants and ancestors --
    
    // allDescendants[r] = all routes that "r" can reach (r is harder than them).
    // allAncestors[r]   = all routes that can reach "r" (i.e., all routes that are harder than r).
    let allDescendants = {};
    let allAncestors = {};
    
    for (const r of routes) {
      // -----------------
      // Descendants BFS
      // -----------------
      const visited = new Set();
      const queue = [r];  // start from route r
      while (queue.length > 0) {
        const current = queue.shift();
        // For every route that current is harder than:
        for (const neighbor of adjacency[current]) {
          if (!visited.has(neighbor) && neighbor !== r) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      // Now "visited" is the set of all routes we can reach from r
      allDescendants[r] = visited;
    
      // -----------------
      // Ancestors BFS
      // -----------------
      const visitedAnc = new Set();
      const queueAnc = [r];
      while (queueAnc.length > 0) {
        const current = queueAnc.shift();
        // For every route that is harder than current:
        for (const neighbor of adjacencyReversed[current]) {
          if (!visitedAnc.has(neighbor) && neighbor !== r) {
            visitedAnc.add(neighbor);
            queueAnc.push(neighbor);
          }
        }
      }
      allAncestors[r] = visitedAnc;
    }
    
    // At this point, you have two sets for each route:
    //    allDescendants[r] = { all routes r is harder than (direct or indirect) }
    //    allAncestors[r]   = { all routes that are harder than r (direct or indirect) }
    
    // You can then compute a coverage-based certainty. For example:
    let certaintyScores = {};
    for (const r of routes) {
      const ancestorSet = allAncestors[r];
      const descendantSet = allDescendants[r];
      const unionSet = new Set([...ancestorSet, ...descendantSet]); 
      const coverage = unionSet.size / (routes.length - 1);

      certaintyScores[r] = coverage * 100;               // turn it into a 0..100 scale
    }
    
    // Then finally, update your DB with the new certainty scores:
    for (const r of routes) {
      await pool.query(
        "UPDATE routes SET certainty_score = $1 WHERE id = $2;",
        [certaintyScores[r], r]
      );
    }



    console.log(`Ranking ${routes.length} routes based on ${comparisons.length} comparisons using Bradley–Terry model...`);

    for (let iter = 0; iter < ITERATIONS; iter++) {
      let strengthUpdates = {};
      routes.forEach(id => strengthUpdates[id] = 0);

      comparisons.forEach(({ harder_route_id, easier_route_id, weight }) => {
        const s_harder = strengths[harder_route_id];
        const s_easier = strengths[easier_route_id];

        const prob_harder = s_harder / (s_harder + s_easier);
        const prob_easier = s_easier / (s_harder + s_easier);

        strengthUpdates[harder_route_id] += weight * (1 - prob_harder);
        strengthUpdates[easier_route_id] += weight * (0 - prob_easier);
      });

      routes.forEach(id => {
        strengths[id] += strengthUpdates[id];
        if (strengths[id] < 1) strengths[id] = 1;
      });
    }

    const maxStrength = Math.max(...Object.values(strengths));
    routes.forEach(id => strengths[id] = (strengths[id] / maxStrength) * 1000);

    // After ranks are calculated and before updating database:
    const sortedRoutes = routes
    .map(id => ({ id, rank: strengths[id] }))
    .sort((a, b) => a.rank - b.rank); // sorted ascending (easiest to hardest)

    const totalRoutes = sortedRoutes.length;

    function assignVGrade(percentile) {
    if (percentile <= 30) return 'V0';
    if (percentile <= 45) return 'V1';
    if (percentile <= 58) return 'V2';
    if (percentile <= 68) return 'V3';
    if (percentile <= 76) return 'V4';
    if (percentile <= 82) return 'V5';
    if (percentile <= 87) return 'V6';
    if (percentile <= 91) return 'V7';
    if (percentile <= 94) return 'V8';
    if (percentile <= 96) return 'V9';
    if (percentile <= 97.5) return 'V10';
    if (percentile <= 98.5) return 'V11';
    if (percentile <= 99.2) return 'V12';
    if (percentile <= 99.5) return 'V13';
    if (percentile <= 99.7) return 'V14';
    if (percentile <= 99.8) return "V15";
    if (percentile <= 99.9) return "V16";
    return 'V17';
    }

    // Assign estimated V-grades based on percentile rank
    for (let i = 0; i < totalRoutes; i++) {
    const percentile = (i / totalRoutes) * 100;
    sortedRoutes[i].estimated_v_grade = assignVGrade(percentile);
    }

    // Update database
    for (const route of sortedRoutes) {
    await pool.query(
      `
        UPDATE routes 
        SET calculated_rank = $1,
            estimated_v_grade = $2 
        WHERE id = $3;
      `,
      [
        route.rank,
        route.estimated_v_grade, 
        route.id
      ]
    );
    }

    console.log("Ranking and certainty calculation complete!");

  } catch (err) {
    console.error("Error calculating ranks:", err);
  } finally {
    pool.end();
  }
}

calculateBradleyTerryRanks();
