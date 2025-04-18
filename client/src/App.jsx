import { useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
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

  // Fetch routes only if user is logged in.
  useEffect(() => {
    if (user) {
      refetchRoutes();
    }
  }, [user]);

  return (
    <Router>
      <div className="container">
        <h1>Climbed Out</h1>
        <h3>Consensus Grading</h3>
        {/*Image to come*/}
      </div>

      <div className="container user-bar">
        {user && <Header user={user} setUser={setUser} />}
      </div>

      <div className="container main-content">
        <Routes>
          {user ? (
            <>
              <Route path="/" element={<HomePage routes={routes} user={user} />} />
              <Route path="/add-route" element={<AddRoutePage />} />
              <Route path="/add-route/:routeName" element={<AddRoutePage />} />
              <Route path="/route/:id" element={<RoutePage user={user} />} />
              <Route path="/ranking" element={<RankingDisplay routes={routes} />} />
              <Route path="/account" element={<AccountManagement user={user} setUser={setUser} />} />
              <Route path="/compare-routes" element={<CompareRoutesPage refetchRoutes={refetchRoutes}/>} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
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
