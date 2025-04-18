import { useState } from "react";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
      } else {
        setMessage("If your email is registered, you'll receive a reset link.");
      }
    } catch (err) {
      console.error(err);
      setMessage("An error occurred.");
    }
  };

  return (
    <div className="container">
      <h2>Forgot Password</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Email:
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <button type="submit">Request Reset</button>
      </form>
    </div>
  );
}

export default ForgotPasswordPage;
