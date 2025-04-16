import { useNavigate, Link } from "react-router-dom";

function Header({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  return (
    <div>
      <span>Welcome, {user.username} | </span>
      <Link to="/account">Account</Link>
      <button onClick={handleLogout} style={{ marginLeft: "20px" }}>Logout</button>
    </div>
  );
}

export default Header;
