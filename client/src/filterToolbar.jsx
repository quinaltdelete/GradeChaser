// filterToolbar.jsx
import { useState } from "react";

function FilterToolbar({ routes, onFilterChange }) {
  
  // Local state for each filter input.
  const [area, setArea] = useState("");
  const [subArea, setSubArea] = useState("");
  const [country, setCountry] = useState("");
  const [certainty, setCertainty] = useState("");
  const [vGrade, setVGrade] = useState("");
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");

  // State to store applied refinement filters (for display as active tags).
  const [appliedFilters, setAppliedFilters] = useState({});

  // Compute unique values for the datalists.
  const uniqueAreas = Array.from(new Set(routes.map(r => r.area))).filter(Boolean);
  const uniqueSubAreas = Array.from(new Set(routes.map(r => r.sub_area))).filter(Boolean);
  const uniqueCountries = Array.from(new Set(routes.map(r => r.country))).filter(Boolean);
  const uniqueNames = Array.from(new Set(routes.map(r => r.name))).filter(Boolean);

  const handleFilter = () => {
    // Build refinement filters (for narrowing the list).
    const refinementFilters = {};
    if (area) refinementFilters.area = area;
    if (subArea) refinementFilters.subArea = subArea;
    if (country) refinementFilters.country = country;
    if (certainty) refinementFilters.certainty = certainty;
    if (vGrade) refinementFilters.vGrade = vGrade;

    // Build jump filters (for name or rank) but do NOT add these to active tags.
    const jumpFilters = {};
    if (name) jumpFilters.name = name;
    if (rank) jumpFilters.rank = rank;

    // Compute updated filters.
    const updatedFilters = { ...appliedFilters, ...refinementFilters, showUnranked };

    // Update local state and notify parent.
    setAppliedFilters(updatedFilters);
    onFilterChange({ ...updatedFilters, ...jumpFilters });

    // Clear input fields.
    setArea("");
    setSubArea("");
    setCountry("");
    setCertainty("");
    setVGrade("");
    setName("");
    setRank("");
  };

  const clearFilter = (filterName) => {
    const updatedFilters = { ...appliedFilters };
    delete updatedFilters[filterName];
    setAppliedFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  return (
    <div className="filter-toolbar">
      {/* Area */}
      <div className="filter-item">
        <label>
          <span>Area: </span>
          <input
            type="text"
            value={area}
            onChange={e => setArea(e.target.value)}
            list="area-list"
            placeholder="Area"
          />
          <datalist id="area-list">
            {uniqueAreas.map((a, index) => (
              <option key={index} value={a} />
            ))}
          </datalist>
        </label>
      </div>

      {/* Zone */}
      <div className="filter-item">
        <label>
          <span>Zone: </span>
          <input
            type="text"
            value={subArea}
            onChange={e => setSubArea(e.target.value)}
            list="subarea-list"
            placeholder="Zone"
          />
          <datalist id="subarea-list">
            {uniqueSubAreas.map((s, index) => (
              <option key={index} value={s} />
            ))}
          </datalist>
        </label>
      </div>

      {/* Country */}
      <div className="filter-item">
        <label>
          <span>Country: </span>
          <input
            type="text"
            value={country}
            onChange={e => setCountry(e.target.value)}
            list="country-list"
            placeholder="Country"
          />
          <datalist id="country-list">
            {uniqueCountries.map((c, index) => (
              <option key={index} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      {/* Name */}
      <div className="filter-item">
        <label>
          <span>Name: </span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            list="name-list"
            placeholder="Climb Name"
          />
          <datalist id="name-list">
            {uniqueNames.map((n, index) => (
              <option key={index} value={n} />
            ))}
          </datalist>
        </label>
      </div>

      {/* Rank */}
      <div className="filter-item">
        <label>
          <span>Rank: </span>
          <input
            type="number"
            value={rank}
            onChange={e => setRank(e.target.value)}
            placeholder="#"
          />
        </label>
      </div>

      {/* V-Grade */}
      <div className="filter-item">
        <label>
          <span>V-grade: </span>
          <select
            value={vGrade}
            onChange={e => setVGrade(e.target.value)}
          >
            <option value="">Any</option>
            <option value="V0">V0</option>
            <option value="V1">V1</option>
            <option value="V2">V2</option>
            <option value="V3">V3</option>
            <option value="V4">V4</option>
            <option value="V5">V5</option>
            <option value="V6">V6</option>
            <option value="V7">V7</option>
            <option value="V8">V8</option>
            <option value="V9">V9</option>
            <option value="V10">V10</option>
            <option value="V11">V11</option>
            <option value="V12">V12</option>
            <option value="V13">V13</option>
            <option value="V14">V14</option>
            <option value="V15">V15</option>
            <option value="V16">V16</option>
            <option value="V17">V17</option>
          </select>
        </label>
      </div>

      {/* Active refinement filters (tags) */}
      {Object.keys(appliedFilters).length > 0 && (
        <div>
          {appliedFilters.area && (
            <span style={tagStyle}>
              Area: {appliedFilters.area} <button onClick={() => clearFilter("area")}>×</button>
            </span>
          )}
          {appliedFilters.subArea && (
            <span style={tagStyle}>
              Zone: {appliedFilters.subArea} <button onClick={() => clearFilter("subArea")}>×</button>
            </span>
          )}
          {appliedFilters.country && (
            <span style={tagStyle}>
              Country: {appliedFilters.country} <button onClick={() => clearFilter("country")}>×</button>
            </span>
          )}
          {appliedFilters.certainty && (
            <span style={tagStyle}>
              Cert: {appliedFilters.certainty}% <button onClick={() => clearFilter("certainty")}>×</button>
            </span>
          )}
          {appliedFilters.vGrade && (
            <span style={tagStyle}>
              V-Grade: {appliedFilters.vGrade} <button onClick={() => clearFilter("vGrade")}>×</button>
            </span>
          )}
        </div>
      )}

      {/* Filter button */}
      <div className="filter-button-wrapper">
        <button onClick={handleFilter}>
          Apply filters
        </button>
      </div>

    </div>
  );
}

// Simple style for the "tag" display
const tagStyle = {
  display: "inline-block",
  marginRight: "0.5rem",
  background: "#eee",
  padding: "3px 5px",
  borderRadius: "3px",
};

export default FilterToolbar;
