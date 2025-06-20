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

  const [routeSaved, setRouteSaved] = useState(false);
  const [comparison, setComparison] = useState({ easier: "", harder: "" });
  const [allRoutes, setAllRoutes] = useState([]);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [saving, setSaving] = useState(false);

  // Fetch all routes.
  useEffect(() => {
    fetch(`/api/routes`)
      .then((response) => response.json())
      .then((data) => {
        setAllRoutes(data);

        if (routeName) {
          const matchingRoute = data.find(
            (r) => r.name.toLowerCase() === routeName.toLowerCase()
          );
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
      .catch((error) => console.error("Error fetching routes:", error));
  }, [routeName]);

  /* ────────────────── Auto-fill Area/Sub-area/Country when name matches ────────────────── */
  useEffect(() => {
    if (!route.name) return;
    const match = allRoutes.find(
      (r) => r.name.toLowerCase() === route.name.toLowerCase()
    );
    if (match) {
      setRoute((prev) => ({
        ...prev,
        area: match.area || "",
        sub_area: match.sub_area || "",
        country: match.country || "",
      }));
    }
  }, [route.name, allRoutes]);

  const handleNameChange = (e) => {
    // Clear the other fields so stale values don’t linger while typing a new route name
    setRoute({
      ...route,
      name: e.target.value,
      area: "",
      sub_area: "",
      country: "",
    });
    setRouteSaved(false);
  };

  const handleComparisonChange = (e) => {
    const { name, value } = e.target;
    setComparison((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveRoute = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`/api/add-route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(route),
      });
      const data = await response.json();
      if (response.ok) {
        setRouteSaved(true);
        navigate(`/add-route/${data.name}`);
      } else {
        console.error("Error saving route", data);
      }
    } catch (error) {
      console.error("Error saving route", error);
    }
  };

  const saveComparison = async (type) => {
    const comparisonRoute =
      type === "harder" ? comparison.harder : comparison.easier;
    const newRouteName = route.name;

    if (!comparisonRoute) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/add-comparison`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newRoute: newRouteName,
          comparisonRoute,
          type,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSavedComparisons([
          ...savedComparisons,
          `${comparisonRoute} is ${type} than ${newRouteName}`,
        ]);
        setComparison((prev) => ({ ...prev, [type]: "" }));
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
        <div className="form-block">
          <label>
            Name:
            <input
              type="text"
              value={route.name}
              onChange={handleNameChange}
              list="route-name-options"
            />
          </label>
          <datalist id="route-name-options">
            {allRoutes.map((r, index) => (
              <option key={r.id || index} value={r.name} />
            ))}
          </datalist>
  
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
            {Array.from(new Set(allRoutes.map((r) => r.area)))
              .filter(Boolean)
              .map((a, index) => (
                <option key={index} value={a} />
              ))}
          </datalist>
  
          <label>
            Sub-Area:
            <input
              type="text"
              value={route.sub_area}
              onChange={(e) =>
                setRoute({ ...route, sub_area: e.target.value })
              }
              list="subarea-list"
            />
          </label>
          <datalist id="subarea-list">
            {Array.from(new Set(allRoutes.map((r) => r.sub_area)))
              .filter(Boolean)
              .map((s, index) => (
                <option key={index} value={s} />
              ))}
          </datalist>
  
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
            {Array.from(new Set(allRoutes.map((r) => r.country)))
              .filter(Boolean)
              .map((c, index) => (
                <option key={index} value={c} />
              ))}
          </datalist>
  
          <div className="left-button-group">
            <button onClick={handleSaveRoute}>Next</button>
            <button onClick={() => navigate("/")}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <h3>Comparisons for {route.name}</h3>
  
          <div className="comparison-flex">
            <div className="comparison-left">
              <div className="comparison-entry">
                <label>
                  Enter a route that's harder than {route.name}:
                  <input
                    type="text"
                    name="harder"
                    value={comparison.harder}
                    onChange={handleComparisonChange}
                    list="harder-route-options"
                  />
                </label>
                <datalist id="harder-route-options">
                  {allRoutes
                    .filter((r) => r.name !== route.name)
                    .map((r) => (
                      <option key={r.id} value={r.name} />
                    ))}
                </datalist>
                <button onClick={() => saveComparison("harder")}>Enter</button>
              </div>
  
              <div className="comparison-entry">
                <label>
                  Enter a route that's easier than {route.name}:
                  <input
                    type="text"
                    name="easier"
                    value={comparison.easier}
                    onChange={handleComparisonChange}
                    list="easier-route-options"
                  />
                </label>
                <datalist id="easier-route-options">
                  {allRoutes
                    .filter((r) => r.name !== route.name)
                    .map((r) => (
                      <option key={r.id} value={r.name} />
                    ))}
                </datalist>
                <button onClick={() => saveComparison("easier")}>Enter</button>
              </div>
            </div>
  
            {savedComparisons.length > 0 && (
              <div className="comparison-right">
                <h4>Your Comparisons:</h4>
                <ul>
                  {savedComparisons.map((comparison, index) => (
                    <li key={index}>{comparison}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
  
          <button
            style={{ marginTop: "20px" }}
            onClick={async () => {
              fetch("/api/recalculate-ranks", { method: "POST" }).catch(err => console.error("Could not start re-calc:", err));
              navigate("/");
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );  
}

export default AddRoutePage;
