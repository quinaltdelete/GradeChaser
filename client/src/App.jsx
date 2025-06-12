import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from "react-router-dom";
import HomePage from "./HomePage"; 
import AddRoutePage from "./AddRoutePage";
import RankingDisplay from "./RankingDisplay";
import RoutePage from "./RoutePage";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import AccountManagement from "./AccountManagement";
import Header from "./Header";
import CompareRoutesPage from "./CompareRoutesPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage";
import "./App.css";

function App() {
  const [routes, setRoutes] = useState([]);
  const [user, setUser] = useState(
    import.meta.env.MODE === 'development'
      ? { username: 'dev_user' }
      : null
  );  

  const refetchRoutes = () => {
    return fetch(`/api/routes`)
    .then(res => res.json())
    .then(data => setRoutes(data))
    .catch(err => console.error("Error fetching routes:", err));
  }

   // Check for token on app load.
   useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Fetch the user from the server:
      fetch(`/api/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem("token");
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setUser({ username: data.username });
          }
        })
        .catch((err) => {
          console.error("Error verifying token:", err);
          localStorage.removeItem("token");
        });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await fetch(`/api/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            localStorage.removeItem("token");
            setUser(null);
          }
        } catch (err) {
          console.error("Periodic token check failed:", err);
          localStorage.removeItem("token");
          setUser(null);
        }
      }
    }, 10 * 60 * 1000); // every 10 minutes
  
    return () => clearInterval(interval);
  }, []);  

  // Fetch routes only if user is logged in.
  useEffect(() => {
    if (user) {
      refetchRoutes();
    }
  }, [user]);

  return (
    <Router>
      <div className="container">
        <h1>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            Climbed Out
          </Link>
        </h1>
        <h3>Consensus Grading</h3>
      </div>
      {/*Image to come*/}

      <div className="container user-bar">
        {user && <Header user={user} setUser={setUser} />}
      </div>

      <div className="container main-content">
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          {user ? (
            <>
              <Route path="/" element={<HomePage routes={routes} user={user} />} />
              <Route path="/add-route" element={<AddRoutePage />} />
              <Route path="/add-route/:routeName" element={<AddRoutePage />} />
              <Route path="/route/:id" element={<RoutePage user={user} />} />
              <Route path="/ranking" element={<RankingDisplay routes={routes} />} />
              <Route path="/account" element={<AccountManagement user={user} setUser={setUser} />} />
              <Route path="/compare-routes" element={<CompareRoutesPage refetchRoutes={refetchRoutes}/>} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<LoginPage setUser={setUser} />} />
              <Route path="/signup" element={<SignupPage setUser={setUser} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
