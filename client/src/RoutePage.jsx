import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function RoutePage({ user }) {
  const { id } = useParams(); // Get route ID from URL
  const navigate = useNavigate();
  const [route, setRoute] = useState(null);
  const [comparisons, setComparisons] = useState([]);

  // Fetch route details and comparisons for the active user.
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`/api/route/${id}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`  // Ensure token is sent.
      }
    })
      .then(response => response.json())
      .then(data => {
        setRoute(data.route);
        setComparisons(data.comparisons);
      })
      .catch(error => console.error("Error fetching route:", error));
  }, [id]);

  // Delete comparison
  const deleteComparison = async (comparisonId) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`/api/delete-comparison/${comparisonId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      // Remove comparison from state
      setComparisons(comparisons.filter(comp => comp.id !== comparisonId));
    } else {
      console.error("Error deleting comparison");
    }
  };

  if (!route) return <p>Loading...</p>;

  // Group comparisons based on type.
  const easierComparisons = comparisons.filter(comp => comp.type === "easier");
  const harderComparisons = comparisons.filter(comp => comp.type === "harder");

  return (
    <div className="container">
      <h2 style={{ borderBottom: "1px solid #ccc", paddingBottom: "0.3em" }}>
        {route.name} – {route.area}
      </h2>
  
      <h3>Your Comparisons</h3>
  
      <div className="comparison-sections">
        {/* Harder Comparisons */}
        <div className="comparison-column">
          <h4>Climbs Harder than {route.name}</h4>
          {harderComparisons.length > 0 ? (
            <ul className="comparison-list">
              {harderComparisons.map(comp => (
                <li key={comp.id}>
                  <span>{comp.compared_route} is harder than {route.name}</span>
                  <button onClick={() => deleteComparison(comp.id)} className="delete-button">Delete</button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No harder comparisons found.</p>
          )}
        </div>
  
        {/* Easier Comparisons */}
        <div className="comparison-column">
          <h4>Climbs Easier than {route.name}</h4>
          {easierComparisons.length > 0 ? (
            <ul className="comparison-list">
              {easierComparisons.map(comp => (
                <li key={comp.id}>
                  <span>{comp.compared_route} is easier than {route.name}</span>
                  <button onClick={() => deleteComparison(comp.id)} className="delete-button">Delete</button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No easier comparisons found.</p>
          )}
        </div>
      </div>
  
      <div className="button-group" style={{ marginTop: "2em" }}>
        <button onClick={() => navigate(`/add-route/${route.name}`)}>
          Add a new comparison
        </button>
        <button onClick={() => navigate("/ranking")}>
          Back to rankings
        </button>
      </div>
    </div>
  );  
}

export default RoutePage;
