import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function GenerateTicklistPage({ user }) {
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [filteredAreas, setFilteredAreas] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ticklist, setTicklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch areas for autocomplete
  useEffect(() => {
    fetch('/api/areas')
      .then(res => res.json())
      .then(data => setAreas(data))
      .catch(err => console.error('Error fetching areas:', err));
  }, []);

  // Filter areas based on input
  useEffect(() => {
    if (selectedArea) {
      const filtered = areas.filter(area =>
        area.toLowerCase().includes(selectedArea.toLowerCase())
      );
      setFilteredAreas(filtered);
    } else {
      setFilteredAreas([]);
    }
  }, [selectedArea, areas]);

  const handleAreaChange = (e) => {
    setSelectedArea(e.target.value);
    setShowSuggestions(true);
    setError('');
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedArea.trim()) {
      setError('Please select an area');
      return;
    }

    setLoading(true);
    setError('');
    setTicklist(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/generate-ticklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ area: selectedArea })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate ticklist');
      }

      setTicklist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRouteTable = (routes, title) => {
    if (routes.length === 0) return null;

    return (
      <div style={{ marginBottom: '2em' }}>
        <h3>{title}</h3>
        <table className="ranking-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Route Name</th>
              <th>Zone</th>
              <th>Country</th>
              <th>Book Grade</th>
              <th>Estimated Grade</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td>
                  <Link to={`/route/${route.id}`}>
                    {route.name}
                  </Link>
                </td>
                <td>{route.sub_area}</td>
                <td>{route.country}</td>
                <td>{route.book_grade}</td>
                <td>{route.estimated_v_grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <h2>Generate Ticklist</h2>
      <p>Generate a personalized ticklist based on your climbing preferences and ranking history.</p>

      <div style={{ marginBottom: '2em' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 'none', margin: '0' }}>
          <label htmlFor="area" style={{ display: 'block', marginBottom: '0.5em', fontWeight: '500' }}>
            Select Area:
          </label>
          <div style={{ position: 'relative', marginBottom: '1em' }}>
            <input
              type="text"
              id="area"
              value={selectedArea}
              onChange={handleAreaChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Start typing an area name..."
              style={{
                width: '300px',
                padding: '6px 8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'var(--font-family)',
                boxSizing: 'border-box'
              }}
            />
            {showSuggestions && filteredAreas.length > 0 && (
              <ul className="suggestion-list" style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                width: '300px',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                margin: 0,
                padding: '5px'
              }}>
                {filteredAreas.slice(0, 10).map((area, index) => (
                  <li
                    key={index}
                    onClick={() => handleAreaSelect(area)}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 8px',
                      listStyle: 'none'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#eee'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                  >
                    {area}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#444444' : '#000000',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '6px 12px',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              fontFamily: 'var(--font-family)'
            }}
          >
            {loading ? 'Generating...' : 'Generate Ticklist'}
          </button>
        </form>
      </div>

      {error && (
        <div className="error-message" style={{
          backgroundColor: '#ffebee',
          padding: '10px',
          borderRadius: '4px',
          marginTop: '1em',
          marginBottom: '1em'
        }}>
          {error}
        </div>
      )}

      {ticklist && (
        <div>
          <h3>Your Ticklist for {ticklist.area}</h3>
          <p>Based on {ticklist.userStats.totalRanked} routes you've ranked so far.</p>

          {renderRouteTable(ticklist.ticklist.projects, 'Projects (Hard Routes)')}
          {renderRouteTable(ticklist.ticklist.sessionable, 'Sessionable Climbs')}
          {renderRouteTable(ticklist.ticklist.warmups, 'Warmups')}

          {ticklist.ticklist.projects.length === 0 && 
           ticklist.ticklist.sessionable.length === 0 && 
           ticklist.ticklist.warmups.length === 0 && (
            <p>No routes found in this area that you haven't already ranked.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GenerateTicklistPage;