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
      {" | "}
      <button
        onClick={handleLogout}
        className="link-button"
        style={{
          textDecoration: "none",
          color: "#3b6fd1",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontSize: "1em",
          fontFamily: "inherit"
        }}
        onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
      >
        Logout
      </button>
    </div>
  );
}

export default Header;
