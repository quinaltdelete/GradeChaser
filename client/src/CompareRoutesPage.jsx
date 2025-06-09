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

  // === Area filter state ===
  const [areaInput, setAreaInput] = useState("");
  const [selectedAreas, setSelectedAreas] = useState([]);

  // Build a list of unique area names for autocomplete
  const areaOptions = Array.from(
    new Set(allRoutes.map(r => r.area).filter(Boolean))
  ).sort();

  // Filter area options that match the current input and haven't been selected yet
  const filteredAreaOptions = areaOptions.filter(
    a =>
      a.toLowerCase().includes(areaInput.toLowerCase()) &&
      !selectedAreas.includes(a)
  );
  // =============================

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
    // === Use area filter ===
    const filteredRoutes = selectedAreas.length
      ? allRoutes.filter(
          r =>
            selectedAreas.includes(r.area) &&
            !skippedRoutesRef.current.includes(r.id)
        )
      : allRoutes.filter(r => !skippedRoutesRef.current.includes(r.id));

    // If fewer than 2 unskipped routes remain, there's not enough to display
    if (filteredRoutes.length < 2) {
      setNoMoreRoutes(true);
      setLeftRoute(null);
      setRightRoute(null);
      return;
    }

    // Try a certain number of times to find a new pair
    let attempts = 0;
    while (attempts < 50) {
      // pick two random distinct indexes
      const i1 = Math.floor(Math.random() * filteredRoutes.length);
      const i2 = Math.floor(Math.random() * filteredRoutes.length);
      if (i1 === i2) {
        attempts++;
        continue;
      }

      const candidateLeft = filteredRoutes[i1];
      const candidateRight = filteredRoutes[i2];

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
    setLeftRoute(null);
    setRightRoute(null);
  };

  // Whenever we load allRoutes or selectedAreas, attempt picking our first pair
  useEffect(() => {
    if (allRoutes.length > 0) {
      pickRandomPair();
    }
    // eslint-disable-next-line
  }, [allRoutes, selectedAreas]);

  // Helper to refresh with a new pair
  const updateDisplayedRoute = (side) => {
    // === Use area filter ===
    const filteredRoutes = selectedAreas.length
      ? allRoutes.filter(
          r =>
            selectedAreas.includes(r.area) &&
            !skippedRoutesRef.current.includes(r.id)
        )
      : allRoutes.filter(r => !skippedRoutesRef.current.includes(r.id));

    if (filteredRoutes.length < 2) {
      setNoMoreRoutes(true);
      setLeftRoute(null);
      setRightRoute(null);
      return;
    }

    // routeToKeep is whichever route isn't being replaced
    const routeToKeep = side === "left" ? rightRoute : leftRoute;

    let attempts = 0;
    while (attempts < 100) {
      const candidate = filteredRoutes[Math.floor(Math.random() * filteredRoutes.length)];
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
    setLeftRoute(null);
    setRightRoute(null);
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
        setUsedPairs((prev) => {
          const updated = [...prev, pairKey];
          usedPairsRef.current = updated;
          return updated;
        });

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

  const handleBackToHome = async () => {
    try {
      await refetchRoutes();
      navigate("/");
    } catch (err) {
      console.error("Error handling 'Back to home':", err);
    }
  };

  // === UI rendering for area filter ===
  const renderAreaFilterBar = () => (
    <div style={{ marginBottom: '16px' }}>
      <label>
        <strong>Only include routes from:</strong>
        <input
          type="text"
          value={areaInput}
          placeholder="Type an area name..."
          onChange={e => setAreaInput(e.target.value)}
          style={{ marginLeft: 8, width: 200 }}
          list="area-autocomplete-list"
          onKeyDown={e => {
            if (
              e.key === "Enter" &&
              areaInput &&
              areaOptions.includes(areaInput) &&
              !selectedAreas.includes(areaInput)
            ) {
              setSelectedAreas([...selectedAreas, areaInput]);
              setAreaInput("");
              pickRandomPair();
            }
          }}
        />
      </label>
      <button
        onClick={() => {
          if (
            areaInput &&
            areaOptions.includes(areaInput) &&
            !selectedAreas.includes(areaInput)
          ) {
            setSelectedAreas([...selectedAreas, areaInput]);
            setAreaInput("");
            pickRandomPair();
          }
        }}
        disabled={
          !areaInput ||
          !areaOptions.includes(areaInput) ||
          selectedAreas.includes(areaInput)
        }
        style={{ marginLeft: 8 }}
      >
        Add
      </button>
      <datalist id="area-autocomplete-list">
        {filteredAreaOptions.map(option => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div style={{ marginTop: 8 }}>
        {selectedAreas.map(area => (
          <span
            key={area}
            style={{
              display: "inline-block",
              background: "#eee",
              borderRadius: "12px",
              padding: "4px 12px",
              marginRight: 8,
              marginBottom: 4,
            }}
          >
            {area}{" "}
            <button
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: "bold",
              }}
              aria-label={`Remove ${area}`}
              onClick={() => {
                setSelectedAreas(selectedAreas.filter(a => a !== area));
                pickRandomPair();
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
  // ================================

  if (noMoreRoutes) {
    return (
      <div>
        <h2>There are no new routes for you to rank.</h2>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  if (!leftRoute || !rightRoute) return <p>Loading...</p>;

  return (
    <div>
      <h2>Compare Routes</h2>
      {renderAreaFilterBar()}
      <p className="compare-routes-header">
        Only compare routes you've sent. Even if you "know" one route is harder than the other, 
        if you haven't sent it, don't rate it. Try to base your decision on how hard the route felt 
        in the moment. 
      </p>
      <div className="compare-cards-container">
        {/* Left Route */}
        <div className="compare-route-box">
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
        <div className="compare-route-box">
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