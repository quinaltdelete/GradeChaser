import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

// Ordinal helper
function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function AccountManagement({ user, setUser }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // user stats state
  const [userStats, setUserStats] = useState({
    numRanked: null,
    hardestRoute: null,
  });

  useEffect(() => {
    async function fetchUserStats() {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch("/api/user-stats", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const stats = await response.json();
          setUserStats(stats);
        }
      } catch (err) {
        console.error("Error fetching user stats:", err);
      }
    }
    if (expandedSection === "stats") {
      fetchUserStats();
    }
  }, [expandedSection]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Error changing password.");
      } else {
        setMessage("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error(err);
      setMessage("An error occurred.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/delete-account`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error || "Error deleting account.");
      } else {
        localStorage.removeItem("token");
        setUser(null);
        navigate("/signup");
      }
    } catch (err) {
      console.error(err);
      setMessage("An error occurred while deleting account.");
    }
  };

  return (
    <div className="container">
      <h2>Account Management</h2>
      {message && <p className="error-message">{message}</p>}

      <div>
        <h3 onClick={() => toggleSection("stats")} style={{ cursor: "pointer" }}>
          {expandedSection === "stats" ? "▼" : "▶"} Your Stats
        </h3>
        {expandedSection === "stats" && (
          <div style={{ marginBottom: "1em" }}>
            {userStats.numRanked === null ? (
              <p>Loading...</p>
            ) : (
              <>
                <p>You've ranked <strong>{userStats.numRanked}</strong> climb{userStats.numRanked === 1 ? '' : 's'}.</p>
                <p>
                  <Link to="/compare-routes" style={{ color: "#1c6ae4", textDecoration: "underline" }}>
                    Go rank some more!
                  </Link>
                </p>
                {userStats.hardestRoute ? (
                  <p>
                    Your hardest route so far is <strong>{userStats.hardestRoute.name}</strong>,
                    which is the <strong>
                      {getOrdinal(userStats.hardestRoute.rank)}
                    </strong>{" "}
                    hardest climb in the world!
                  </p>
                ) : (
                  <p>You haven't ranked any routes yet.</p>
                )}
              </>
            )}
          </div>
        )}

        <h3 onClick={() => toggleSection("password")} style={{ cursor: "pointer" }}>
          {expandedSection === "password" ? "▼" : "▶"} Change Password
        </h3>
        {expandedSection === "password" && (
          <form onSubmit={handleChangePassword} className="form-block">
            <label>
              Current Password:
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label>
              New Password:
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label>
              Confirm New Password:
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit">Change Password</button>
          </form>
        )}

        <h3 onClick={() => toggleSection("delete")} style={{ cursor: "pointer" }}>
          {expandedSection === "delete" ? "▼" : "▶"} Delete Account
        </h3>
        {expandedSection === "delete" && (
          <div style={{ marginLeft: "20px" }}>
            <p>This action is irreversible.</p>
            <button
              onClick={handleDeleteAccount}
              style={{ backgroundColor: "red", color: "white" }}
            >
              Delete Account
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: "2em" }}>
        <button onClick={() => navigate("/")}>Back</button>
      </div>
    </div>
  );
}

export default AccountManagement;