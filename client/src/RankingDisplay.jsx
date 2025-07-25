import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import FilterToolbar from "./filterToolbar";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function RankingDisplay({ routes, user }) {
  const navigate = useNavigate(); 
  const [showUnranked, setShowUnranked] = useState(false);

  // Global routes sorted by calculated_rank in descending order.
  const sortedGlobalRoutes = Array.isArray(routes)
    ? [...routes].sort((a, b) => b.calculated_rank - a.calculated_rank)
    : [];

  // Initialize rankingType from localStorage only if user is logged in.
  // For logged-out users, always show global ranking.
  const [rankingType, setRankingType] = useState(() => {
    if (!user) return "global";
    return localStorage.getItem("rankingType") || "global";
  });

  // Personal ranking routes state.
  const [personalRoutes, setPersonalRoutes] = useState([]);

  // Filter state: includes both refinement filters and jump filters.
  const [filters, setFilters] = useState({
    area: "",
    subArea: "",
    country: "",
    certainty: "",
    vGrade: "",
    name: "",
    rank: ""
  });

  // Pagination state.
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // State to hold the highlighted route ID (for jump filters).
  const [highlightedRouteId, setHighlightedRouteId] = useState(null);

  // If user logs out, reset to global ranking
  useEffect(() => {
    if (!user && rankingType === "personal") {
      setRankingType("global");
    }
  }, [user, rankingType]);

  // Persist rankingType to localStorage whenever it changes, but only if user is logged in.
  useEffect(() => {
    if (user) {
      localStorage.setItem("rankingType", rankingType);
    }
  }, [rankingType, user]);

  // When rankingType is "personal", fetch personal rankings from the API.
  useEffect(() => {
    if (rankingType === "personal" && user) {
      const token = localStorage.getItem("token");
      if (token) {
        fetch(`/api/personal-ranking`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        })
          .then((response) => response.json())
          .then((data) => {
            setPersonalRoutes(Array.isArray(data) ? data : []);
          })
          .catch((error) => console.error("Error fetching personal rankings:", error));
      }
    }
  }, [rankingType, user]);

  const sortedPersonalRoutes = [...personalRoutes].sort((a, b) => b.personal_score - a.personal_score);

  // Choose which list to rank based on rankingType.
  const listToRank =
    rankingType === "global" ? sortedGlobalRoutes : sortedPersonalRoutes;

  // Callback from FilterToolbar.
  // - Refinement filters: area, subArea, country, certainty, vGrade are used to narrow the list.
  // - Jump filters: name and rank are used only to compute the jumpPage and highlighted route.
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    let refined = listToRank;
    if (newFilters.area) {
      refined = refined.filter(route =>
        route.area.toLowerCase().includes(newFilters.area.toLowerCase())
      );
    }
    if (newFilters.subArea) {
      refined = refined.filter(route =>
        route.sub_area.toLowerCase().includes(newFilters.subArea.toLowerCase())
      );
    }
    if (newFilters.country) {
      refined = refined.filter(route =>
        route.country.toLowerCase().includes(newFilters.country.toLowerCase())
      );
    }
    if (newFilters.certainty) {
      const threshold = parseFloat(newFilters.certainty);
      refined = refined.filter(route => route.certainty_score >= threshold);
    }
    if (newFilters.vGrade) {
      refined = refined.filter(route =>
        route.estimated_v_grade === newFilters.vGrade
      );
    }

    // Process jump filters (name and rank) to compute jump page and target route.
    let jumpPage = 0;
    let targetRoute = null;
    if (newFilters.name) {
      const nameIndex = refined.findIndex(route =>
        route.name.toLowerCase().includes(newFilters.name.toLowerCase())
      );
      if (nameIndex >= 0) {
        targetRoute = refined[nameIndex];
        jumpPage = Math.floor(nameIndex / itemsPerPage);
      }
    } else if (newFilters.rank) {
      const rankIndex = parseInt(newFilters.rank, 10) - 1; // Convert 1-indexed rank to zero-based.
      if (rankIndex >= 0 && rankIndex < refined.length) {
        targetRoute = refined[rankIndex];
        jumpPage = Math.floor(rankIndex / itemsPerPage);
      }
    }
    setHighlightedRouteId(targetRoute ? targetRoute.id : null);
    setCurrentPage(jumpPage);
  };

  // Compute refined routes using only the refinement filters.
  let refinedRoutes = listToRank.filter(route => {
    // Exclude unranked unless showUnranked is true
    if (!showUnranked && !route.has_comparisons) return false;
    // Apply refinement filters
    if (filters.area && !route.area.toLowerCase().includes(filters.area.toLowerCase())) return false;
    if (filters.subArea && !route.sub_area.toLowerCase().includes(filters.subArea.toLowerCase())) return false;
    if (filters.country && !route.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.certainty && route.certainty_score < parseFloat(filters.certainty)) return false;
    if (filters.vGrade && route.estimated_v_grade !== filters.vGrade) return false;
    return true;
  });  

  const totalPages = Math.ceil(refinedRoutes.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const currentRoutes = refinedRoutes.slice(startIndex, startIndex + itemsPerPage);

  // If the highlighted route isn't on the current page, remove the highlight.
  useEffect(() => {
    if (!currentRoutes.some(route => route.id === highlightedRouteId)) {
      setHighlightedRouteId(null);
    }
  }, [currentRoutes, highlightedRouteId]);

  const handlePrevious = () => setCurrentPage(prev => Math.max(prev - 1, 0));
  const handleNext = () => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));

  return (
    <div>
      <p style={{ textAlign: "center", fontSize: "18px" }}> Overall Ranking ({rankingType}):</p>

      <div className="left-button-group" style={{ marginBottom: "1em" }}>
        {user ? (
          <>
            <button
              onClick={() => {
                setRankingType(prev => (prev === "global" ? "personal" : "global"));
                setCurrentPage(0);
              }}
            >
              {rankingType === "global"
                ? "See personal ranking"
                : "See global ranking"}
            </button>
            <Link to="/add-route">
              <button>Rank a Specific Route</button>
            </Link>
            <button onClick={() => navigate("/compare-routes")}>
              Compare Random Routes
            </button>
            <button onClick={() => navigate("/generate-ticklist")}>
              Generate a ticklist
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", width: "100%" }}>
            <Link to="/login" style={{ fontWeight: "bold", fontSize: "14px", color: "#2266bb" }}>
              Log in to add your routes.
            </Link>
          </div>
        )}
      </div>

      <FilterToolbar routes={routes} onFilterChange={handleFilterChange} />

      <div style={{ margin: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "0px" }}>
          <input
            type="checkbox"
            checked={showUnranked}
            onChange={() => {
              setShowUnranked(prev => !prev);
              setCurrentPage(0);
            }}
          />
          Show unranked climbs
        </label>
      </div>
      
      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Route Name</th>
            <th>Area</th>
            <th>Zone</th>
            <th>Country</th>
            <th>
              Book Grade
              <span className="info-icon" tabIndex={0}>i
                <span className="tooltip">
                  This is the grade of the climb according to at least one published source. 
                  Different sources might report different grades.
                </span>
              </span>
            </th>
            <th>
              Estimated Grade
              <span className="info-icon" tabIndex={0}>i
                <span className="tooltip">
                  This is what we estimate the grade for this climb should be, 
                  based on its place in the ranking.
                </span>
              </span>
            </th>

            <th>
              Certainty
              <span className="info-icon" tabIndex={0}>i
                <span className="tooltip">
                  This is roughly how certain we are that this climb should be at this spot in the ranking. 
                  Climbs with low certainty might seem like they're in the wrong place in the ranking. 
                  More climbers comparing this route will increase the certainty.
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {currentRoutes.map((route, index) => (
            <tr key={route.id}>
              <td>{startIndex + index + 1}</td>
              <td>
                {user ? (
                  <Link to={`/route/${route.id}`} style={{ textDecoration: "none", color: "blue" }}>
                    {route.id === highlightedRouteId ? <strong>{route.name}</strong> : route.name}
                  </Link>
                ) : (
                  route.id === highlightedRouteId ? <strong>{route.name}</strong> : route.name
                )}
              </td>
              <td>{route.area}</td>
              <td>{route.sub_area}</td>
              <td>{route.country}</td>
              <td>{route.book_grade}</td>
              <td>{route.estimated_v_grade}</td>
              <td>{(route.certainty_score).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "4px", marginBottom: "12px", fontSize: "14px", color: "#666" }}>
        out of {routes.length} climbs
      </div>

      <div className="left-button-group">
        <button
          className="link-button"
          onClick={handlePrevious}
          disabled={currentPage === 0}
        >
           {"\u2190"} Show previous {itemsPerPage}
        </button>
        <button
          className="link-button"
          onClick={handleNext}
          disabled={currentPage >= totalPages - 1}
        >
          Show next {itemsPerPage} {"\u2192"}
        </button>
      </div>
    </div>
  );
}

export default RankingDisplay;