import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function CompareRoutesPage({ refetchRoutes }) {
  const navigate = useNavigate();

  // All routes fetched once
  const [allRoutes, setAllRoutes] = useState([]);
  // The two currently displayed routes
  const [leftRoute, setLeftRoute] = useState(null);
  const [rightRoute, setRightRoute] = useState(null);
  // Track routes the user has skipped (i.e. hasn't done them)
  const [skippedRoutes, setSkippedRoutes] = useState([]);
  const skippedRoutesRef = useRef([]);
  // Track which pairs were already displayed this session
  const [usedPairs, setUsedPairs] = useState([]);
  const usedPairsRef = useRef([]);
  // Flag for “no more routes”
  const [noMoreRoutes, setNoMoreRoutes] = useState(false);

  // Fetch all routes once, store them in state
  useEffect(() => {
    async function fetchAllRoutes() {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(`/api/routes`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await response.json();
        // data should be an array of route objects
        setAllRoutes(data);
      } catch (error) {
        console.error("Error fetching all routes:", error);
      }
    }

    fetchAllRoutes();
  }, []);

  // Helper to make a canonical “pair key” like "5,12"
  const getPairKey = (routeA, routeB) => {
    const [id1, id2] = [routeA.id, routeB.id].sort((a, b) => a - b);
    return `${id1},${id2}`;
  };

  // Attempt to pick two distinct routes that:
  //   1) Aren't in the skip list,
  //   2) Haven’t been shown together before (usedPairs),
  //   3) Are not the same route,
  // If we can’t find any new pair, set noMoreRoutes = true.
  const pickRandomPair = () => {
    const unskipped = allRoutes.filter(
      (r) => !skippedRoutesRef.current.includes(r.id)
    );

    // If fewer than 2 unskipped routes remain, there's not enough to display
    if (unskipped.length < 2) {
      setNoMoreRoutes(true);
      return;
    }

    // Try a certain number of times to find a new pair
    let attempts = 0;
    while (attempts < 50) {
      // pick two random distinct indexes
      const i1 = Math.floor(Math.random() * unskipped.length);
      const i2 = Math.floor(Math.random() * unskipped.length);
      if (i1 === i2) {
        attempts++;
        continue;
      }

      const candidateLeft = unskipped[i1];
      const candidateRight = unskipped[i2];

      const pairKey = getPairKey(candidateLeft, candidateRight);

      // If we haven't displayed this pair before, use it
      if (!usedPairsRef.current.includes(pairKey)) {
        setLeftRoute(candidateLeft);
        setRightRoute(candidateRight);
        setNoMoreRoutes(false);
        return;
      }
      attempts++;
    }
    // If we can't find a new pair after many tries, assume no more are available
    setNoMoreRoutes(true);
  };

  // Whenever we load allRoutes, attempt picking our first pair
  useEffect(() => {
    if (allRoutes.length > 0) {
      pickRandomPair();
    }
  }, [allRoutes]);

  // Helper to refresh with a new pair
  const updateDisplayedRoute = (side) => {
    const unskipped = allRoutes.filter(
      (r) => !skippedRoutesRef.current.includes(r.id)
    );
    if (unskipped.length < 2) {
      setNoMoreRoutes(true);
      return;
    }

    // routeToKeep is whichever route isn't being replaced
    const routeToKeep = side === "left" ? rightRoute : leftRoute;

    let attempts = 0;
    while (attempts < 100) {
      const candidate = unskipped[Math.floor(Math.random() * unskipped.length)];
      // Avoid picking the same route that’s on the other side
      if (candidate.id === routeToKeep.id) {
        attempts++;
        continue;
      }

      const pairKey = getPairKey(
        side === "left" ? candidate : leftRoute,
        side === "right" ? candidate : rightRoute
      );

      if (!usedPairsRef.current.includes(pairKey)) {
        // Update either leftRoute or rightRoute
        if (side === "left") {
          setLeftRoute(candidate);
        } else {
          setRightRoute(candidate);
        }
        setNoMoreRoutes(false);
        return;
      }
      attempts++;
    }

    setNoMoreRoutes(true);
  };

  // The user says “this route is harder”
  const handleVote = async (side) => {
    if (!leftRoute || !rightRoute) return;

    const token = localStorage.getItem("token");
    let newRouteName, comparisonRouteName;

    if (side === "left") {
      comparisonRouteName = leftRoute.name;
      newRouteName = rightRoute.name;
    } else {
      comparisonRouteName = rightRoute.name;
      newRouteName = leftRoute.name;
    }

    try {
      const response = await fetch(`/api/add-comparison`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          newRoute: newRouteName,
          comparisonRoute: comparisonRouteName,
          type: "harder"
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Mark this pair as used in this session so we don't see it again
        const pairKey = getPairKey(leftRoute, rightRoute);
        console.log("Pair key for the compared routes: " + pairKey);
        setUsedPairs((prev) => {
          const updated = [...prev, pairKey];
          usedPairsRef.current = updated;
          return updated;
        });

        /* COMMENTED OUT TO TEST BATCHING
        // Recalculate ranks
        await fetch(`/api/recalculate-ranks`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        */

        // Get a new pair
        pickRandomPair();
      } else {
        console.error("Error saving comparison:", data);
      }
    } catch (error) {
      console.error("Error saving comparison:", error);
    }
  };

  // The user says “I haven’t done this route” for left or right
  // That route is never shown again
  const handleSkip = (side) => {
    if (side === "left" && leftRoute) {
      setSkippedRoutes((prev) => {
        const updated = [...prev, leftRoute.id];
        skippedRoutesRef.current = updated;
        return updated;
      });
      updateDisplayedRoute("left");
    } else if (side === "right" && rightRoute) {
      setSkippedRoutes((prev) => {
        const updated = [...prev, rightRoute.id];
        skippedRoutesRef.current = updated;
        return updated;
      });
      updateDisplayedRoute("right");
    }
  };

  if (noMoreRoutes) {
    return (
      <div>
        <h2>There are no new routes for you to rank.</h2>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  if (!leftRoute || !rightRoute) return <p>Loading...</p>;

  const handleBackToHome = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/recalculate-ranks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      await refetchRoutes();

      navigate("/");
    } catch (err) {
      console.error("Error handling 'Back to home':", err);
    }
  }

  return (
    <div>
      <h2>Compare Routes</h2>
      <h3>Only compare routes you've sent. Even if you "know" one route is harder than the other - if you haven't sent it, don't rate it. </h3>
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px" }}>
        {/* Left Route */}
        <div style={{ border: "1px solid #ccc", padding: "10px", width: "40%" }}>
          <h3>{leftRoute.name}</h3>
          <p>Area: {leftRoute.area}</p>
          <p>Zone: {leftRoute.sub_area}</p>
          <p>Country: {leftRoute.country}</p>
          <div className="button-group">
            <button onClick={() => handleVote("left")}>This route is harder</button>
            <button onClick={() => handleSkip("left")}>I haven't done this route</button>
          </div>
        </div>

        {/* Right Route */}
        <div style={{ border: "1px solid #ccc", padding: "10px", width: "40%" }}>
          <h3>{rightRoute.name}</h3>
          <p>Area: {rightRoute.area}</p>
          <p>Zone: {rightRoute.sub_area}</p>
          <p>Country: {rightRoute.country}</p>
          <div className="button-group">
            <button onClick={() => handleVote("right")}>This route is harder</button>
            <button onClick={() => handleSkip("right")}>I haven't done this route</button>
          </div>
        </div>
      </div>
      <button onClick={handleBackToHome}>Back to Home</button>
    </div>
  );
}

export default CompareRoutesPage;
