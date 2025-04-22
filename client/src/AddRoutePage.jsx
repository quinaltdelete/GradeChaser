import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function AddRoutePage({ setPage }) {
  const { routeName } = useParams();
  const navigate = useNavigate();
  
  const [route, setRoute] = useState({
    name: "",
    area: "",
    sub_area: "",
    country: "",
  });

  const [routeSaved, setRouteSaved] = useState(false); // Store current route.
  const [comparison, setComparison] = useState({ easier: "", harder: ""}); // Store comparison entries.
  const [allRoutes, setAllRoutes] = useState([]); // Store all existing routes.
  const [suggestions, setSuggestions] = useState([]); // Suggested route names.
  // Use for suggesting routes as the user types in the comparisons.
  const [comparisonSuggestions, setComparisonSuggestions] = useState({
    harder: [],
    easier: []
  });
  const [savedComparisons, setSavedComparisons] = useState([]); // Store saved comparisons

  useEffect(() => {
    fetch(`/api/routes`)
      .then(response => response.json())
      .then(data => {
        setAllRoutes(data);
  
        // If routeName is provided, pre-fill it
        if (routeName) {
          const matchingRoute = data.find(r => r.name.toLowerCase() === routeName.toLowerCase());
          if (matchingRoute) {
            setRoute({
              name: matchingRoute.name,
              area: matchingRoute.area || "",
              sub_area: matchingRoute.sub_area || "",
              country: matchingRoute.country || "",
            });
            setRouteSaved(true); 
          }
        }
      })
      .catch(error => console.error("Error fetching routes:", error));
  }, [routeName]);  // Fetch data whenever `routeName` changes
  
  // Normalize the route names by removing the word "the" and extra spaces.
  function normalizeName(name) {
    return name.toLowerCase().replace(/\bthe\b/g, "").replace(/\s+/g, " ").trim();
  }

  // Simple Levenshtein distance algorithm.
  function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  const handleNameChange = (e) => {
    const inputName = e.target.value;
    setRoute({ ...route, name: inputName });
    
    const inputNameNorm = normalizeName(inputName);
    
    // First, try to find direct substring matches (ignoring "the")
    const filteredRoutes = allRoutes.filter(r => {
      const normalizedRouteName = normalizeName(r.name);
      return normalizedRouteName.includes(inputNameNorm);
    });
    
    if (filteredRoutes.length > 0) {
      setSuggestions(filteredRoutes);
    } else {
      // No direct matches found: perform fuzzy matching.
      let bestCandidate = null;
      let bestDistance = Infinity;
      allRoutes.forEach(r => {
        const normalizedRouteName = normalizeName(r.name);
        const distance = levenshteinDistance(inputNameNorm, normalizedRouteName);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = r;
        }
      });
      // Use a threshold; for instance, if the distance is small relative to the input length.
      if (bestCandidate && bestDistance <= Math.max(3, inputNameNorm.length * 0.4)) {
        // Mark candidate as a "did you mean" suggestion.
        setSuggestions([{ ...bestCandidate, isDidYouMean: true }]);
      } else {
        setSuggestions([]);
      }
    }
  };

  // When the user clicks on a suggestion, auto-fill the fields
  const handleSuggestionClick = (suggestedRoute) => {
    setRoute({
      name: suggestedRoute.name,
      area: suggestedRoute.area || "",
      sub_area: suggestedRoute.sub_area || "",
      country: suggestedRoute.country || "",
    });
    setSuggestions([]); // Hide suggestions after selection
  };

  // Save the route.
  const handleSaveRoute = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`/api/add-route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(route),
      });
      const data = await response.json();
      if (response.ok) {
        // Set that the route has been saved
        setRouteSaved(true);
        // Navigate to the comparisons page for this route
        navigate(`/add-route/${data.name}`);
      } else {
        console.error("Error saving route", data);
      }
    } catch (error) {
      console.error("Error saving route", error);
    }
  };  

  // Set the submitted comparison.
  const handleComparisonChange = (e) => {
    const { name, value } = e.target; // Get the field name ("harder" or "easier") and value
    setComparison({ ...comparison, [name]: value });
  
    // Filter existing routes based on user input
    const filteredRoutes = allRoutes.filter(r =>
      r.name.toLowerCase().startsWith(value.toLowerCase()) && r.name !== route.name
    );
  
    setComparisonSuggestions({ ...comparisonSuggestions, [name]: filteredRoutes });
  };

  // Hide the suggested routes dropdown once clicked.
  const handleComparisonSuggestionClick = (name, selectedRoute) => {
    setComparison({ ...comparison, [name]: selectedRoute.name });
    setComparisonSuggestions({ ...comparisonSuggestions, [name]: [] }); // Clear suggestions
  };

  // Save the submitted comparison.
  const saveComparison = async (type) => {
    const comparisonRoute = type === "harder" ? comparison.harder : comparison.easier;
    const newRouteName = route.name;
  
    if (!comparisonRoute) return; // Prevent saving empty comparisons
  
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/add-comparison`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`  // Include the token here
        },
        body: JSON.stringify({
          newRoute: newRouteName,
          comparisonRoute,
          type
        }),
      });
  
      const data = await response.json();
      if (response.ok) {
        setSavedComparisons([
          ...savedComparisons,
          `${comparisonRoute} is ${type} than ${newRouteName}`
        ]);
        if (type === "harder") {
          setComparison(prev => ({ ...prev, harder: "" }));
        } else {
          setComparison(prev => ({ ...prev, easier: "" }));
        }
      } else {
        console.error("Error saving comparison:", data);
      }
    } catch (error) {
      console.error("Error saving comparison:", error);
    }
  };  

  return (
    <div className="container">
      <h2>Rank a Route</h2>

      {!routeSaved ? (
        <div>
          <label>
            Name:
            <input type="text" value={route.name} onChange={handleNameChange} />
          </label>

          {suggestions.length > 0 && (
            <ul style={{ border: "1px solid gray", padding: 5 }}>
              {suggestions.map((s, index) => (
                <li 
                  key={s.id || index} 
                  onClick={() => handleSuggestionClick(s)} 
                  style={{ cursor: "pointer" }}
                >
                  {s.isDidYouMean ? `Did you mean "${s.name}"?` : s.name}
                </li>
              ))}
            </ul>
          )}

          <br />
          <label>
            Area: 
            <input 
              type="text" 
              value={route.area} 
              onChange={(e) => setRoute({ ...route, area: e.target.value })}
              list="area-list"
            />
          </label>
          <datalist id="area-list">
            {Array.from(new Set(allRoutes.map(r => r.area))).filter(Boolean).map((a, index) => (
              <option key={index} value={a} />
            ))}
          </datalist>
          <br />
          <label>
            Sub-Area: 
            <input 
              type="text" 
              value={route.sub_area} 
              onChange={(e) => setRoute({ ...route, sub_area: e.target.value })}
              list="subarea-list"
            />
          </label>
          <datalist id="subarea-list">
            {Array.from(new Set(allRoutes.map(r => r.sub_area))).filter(Boolean).map((s, index) => (
              <option key={index} value={s} />
            ))}
          </datalist>
          <br />
          <label>
            Country: 
            <input 
              type="text" 
              value={route.country} 
              onChange={(e) => setRoute({ ...route, country: e.target.value })}
              list="country-list"
            />
          </label>
          <datalist id="country-list">
            {Array.from(new Set(allRoutes.map(r => r.country))).filter(Boolean).map((c, index) => (
              <option key={index} value={c} />
            ))}
          </datalist>
          <br />
          <div className="left-button-group">
            <button onClick={handleSaveRoute}>Save Route</button>
            <button onClick={() => navigate("/")}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <h3>Comparisons for {route.name}</h3>

          {/* Harder Route Form */}
          <div className="comparison-entry">
            <label>
              Enter a route that's harder than {route.name}:
              <input 
                type="text" 
                name="harder" 
                value={comparison.harder} 
                onChange={handleComparisonChange} />
            </label>

            {comparisonSuggestions.harder.length > 0 && (
              <ul style={{ border: "1px solid gray", padding: 5}}>
                {comparisonSuggestions.harder.map((s) => (
                  <li key={s.id} 
                      onClick={() => handleComparisonSuggestionClick("harder", s)} 
                      style={{ cursor: "pointer" }}>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => saveComparison("harder")}>Save this comparison</button>
          </div>

          {/* Easier Route Form */}
          <div className="comparison-entry">
            <label>
              Enter a route that's easier than {route.name}:
              <input 
                type="text" 
                name="easier" 
                value={comparison.easier} 
                onChange={handleComparisonChange} />
            </label>

            {comparisonSuggestions.easier.length > 0 && (
              <ul style={{ border: "1px solid gray", padding: 5 }}>
                {comparisonSuggestions.easier.map((s) => (
                  <li key={s.id} 
                      onClick={() => handleComparisonSuggestionClick("easier", s)} 
                      style={{ cursor: "pointer" }}>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}

            <button onClick={() => saveComparison("easier")}>Save this comparison</button>
          </div>

          {/* Display Saved Comparisons */}
          {savedComparisons.length > 0 && (
            <div>
              <h4>Your Comparisons:</h4>
              <ul>
                {savedComparisons.map((comparison, index) => (
                  <li key={index}>{comparison}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="left-button-group" onClick={async () => {
            try {
              // Trigger rank recalculation.
              await fetch(`/api/recalculate-ranks`, { method: "POST" });
            } catch (error) {
              console.error("Error recalculating grades:", error);
            } finally {
              navigate("/"); 
              window.location.reload()}
            }
            }>
              Done adding comparisons
          </button>
        </div>
      )}
    </div>
  );
}

export default AddRoutePage;
