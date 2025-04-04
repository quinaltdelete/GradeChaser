import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function AccountManagement({ user, setUser }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
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
        // On successful deletion, log out and redirect to the signup page.
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
      {message && <p style={{ color: "red" }}>{message}</p>}

      <form onSubmit={handleChangePassword}>
        <h3>Change Password</h3>
        <label>
          Current Password:
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <br />
        <label>
          New Password:
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
        </label>
        <br />
        <label>
          Confirm New Password:
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <br />
        <button type="submit">Change Password</button>
      </form>

      <hr />

      <div>
        <h3>Delete Account</h3>
        <p>This action is irreversible.</p>
        <button
          onClick={handleDeleteAccount}
          style={{ backgroundColor: "red", color: "white" }}
        >
          Delete Account
        </button>
      </div>

      <button onClick={() => navigate("/")}>Back</button>
    </div>
  );
}

export default AccountManagement;
