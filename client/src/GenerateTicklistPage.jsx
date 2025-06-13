import { useNavigate } from "react-router-dom";
import { useState } from "react";

function GenerateTicklistPage() {
  const navigate = useNavigate();

  return (
    <div>
      <p>...coming soon.</p>
      <button onClick={() => navigate("/")}>Back</button>
    </div>
  );
}

export default GenerateTicklistPage;