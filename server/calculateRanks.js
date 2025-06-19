require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ITERATIONS     = 200;
const INITIAL_SCORE  = 1000;

/* certainty parameters  */
const TAU1 = 20;            // ~number of votes to reach 63 % of max volume
const ALPHA = 0.40;          // weight of coverage
const BETA = 0.30;           // weight of vote volume
const GAMMA = 0.30;          // weight of opponent diversity
/* α + β + γ must sum to 1                                        */

async function calculateBradleyTerryRanks() {
  try {
    console.log("Fetching data…");

    /* routes & comparisons */
    const routesResult = await pool.query("SELECT id FROM routes;");
    const routes = routesResult.rows.map((row) => row.id);

    const strengths = Object.fromEntries(routes.map((id) => [id, INITIAL_SCORE]));

    const edgesResult = await pool.query(`
      SELECT harder_route_id, easier_route_id, weight
      FROM route_relationships;
    `);
    const comparisons = edgesResult.rows;

    /* prepare adjacency  (for coverage) */
    const adjacency  = {};              // harder to easier
    const adjacencyR = {};              // easier to harder
    routes.forEach((id) => { adjacency[id] = new Set(); adjacencyR[id] = new Set(); });

    comparisons.forEach(({ harder_route_id: h, easier_route_id: e }) => {
      adjacency[h].add(e);
      adjacencyR[e].add(h);
    });

    /* vote volume & unique opponents */
    const counts = {}; 
    routes.forEach((id) => (counts[id] = { votes: 0, opps: new Set() }));

    comparisons.forEach(({ harder_route_id: h, easier_route_id: e, weight }) => {
      counts[h].votes += weight;
      counts[e].votes += weight;
      counts[h].opps.add(e);
      counts[e].opps.add(h);
    });

    /* coverage via BFS per route */
    const allDesc  = {};
    const allAnc   = {};

    for (const r of routes) {
      // descendants (r is harder than …)
      const visD = new Set();
      const qD   = [r];
      while (qD.length) {
        const cur = qD.shift();
        adjacency[cur].forEach((nbr) => {
          if (nbr !== r && !visD.has(nbr)) { visD.add(nbr); qD.push(nbr); }
        });
      }
      allDesc[r] = visD;

      // ancestors (… harder than r)
      const visA = new Set();
      const qA   = [r];
      while (qA.length) {
        const cur = qA.shift();
        adjacencyR[cur].forEach((nbr) => {
          if (nbr !== r && !visA.has(nbr)) { visA.add(nbr); qA.push(nbr); }
        });
      }
      allAnc[r] = visA;
    }

    /* certainty calculation */
    const certaintyScores = {};

    routes.forEach((r) => {
      /* coverage */
      const reachable = new Set([...allDesc[r], ...allAnc[r]]).size;
      const coverage  = reachable / (routes.length - 1);           

      /* vote volume  */
      const nVotes = counts[r].votes;     
      const volume = 1 - Math.exp(-nVotes / TAU1);

      /* opponent diversity */
      const nOpp   = counts[r].opps.size;
      const diversity = nOpp / (routes.length - 1);                

      /* blended certainty */
      const blended =
        ALPHA * coverage +
        BETA  * volume   +
        GAMMA * diversity;

      certaintyScores[r] = Math.min(100, (blended * 100).toFixed(1));
    });

    /* persist certainty */
    for (const r of routes) {
      await pool.query(
        "UPDATE routes SET certainty_score = $1 WHERE id = $2;",
        [certaintyScores[r], r]
      );
    }

    /* Bradley–Terry iterations */
    console.log(
      `Ranking ${routes.length} routes based on ${comparisons.length} comparisons…`
    );

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const delta = Object.fromEntries(routes.map((id) => [id, 0]));

      comparisons.forEach(({ harder_route_id: h, easier_route_id: e, weight }) => {
        const sH = strengths[h];
        const sE = strengths[e];
        const denom = sH + sE;
        delta[h] += weight * (1 - sH / denom);
        delta[e] += weight * (0 - sE / denom);
      });

      routes.forEach((id) => {
        strengths[id] = Math.max(1, strengths[id] + delta[id]);
      });
    }

    /* normalise scores to 0-1000 */
    const maxStrength = Math.max(...Object.values(strengths));
    routes.forEach((id) => (strengths[id] = (strengths[id] / maxStrength) * 1000));

    /* rank list */
    const sortedRoutes = routes
      .map((id) => ({ id, rank: strengths[id] }))
      .sort((a, b) => a.rank - b.rank);

    /* assign V-grades */
    /* NOTE: I just guessed at proportions for now - maybe worth looking at acutal distributions of difficulties */
    const total = sortedRoutes.length;
    function vGrade(p) {
      if (p <= 30) return "V0";
      if (p <= 45) return "V1";
      if (p <= 58) return "V2";
      if (p <= 68) return "V3";
      if (p <= 76) return "V4";
      if (p <= 82) return "V5";
      if (p <= 87) return "V6";
      if (p <= 91) return "V7";
      if (p <= 94) return "V8";
      if (p <= 96) return "V9";
      if (p <= 97.5) return "V10";
      if (p <= 98.5) return "V11";
      if (p <= 99.2) return "V12";
      if (p <= 99.5) return "V13";
      if (p <= 99.7) return "V14";
      if (p <= 99.9) return "V15";
      if (p <= 99.99) return "V16";
      return "V17";
    }

    sortedRoutes.forEach((r, i) => {
      const pct = (i / total) * 100;
      r.estimated_v_grade = vGrade(pct);
    });

    /* persist rank + grade */
    for (const r of sortedRoutes) {
      await pool.query(
        `
        UPDATE routes
        SET calculated_rank = $1,
            estimated_v_grade = $2
        WHERE id = $3;
        `,
        [r.rank, r.estimated_v_grade, r.id]
      );
    }

    console.log("Ranking & certainty calculation complete!");
  } catch (err) {
    console.error("Error calculating ranks:", err);
  } finally {
    pool.end();
  }
}

calculateBradleyTerryRanks();