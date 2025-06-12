import RankingDisplay from "./RankingDisplay";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function HomePage({ routes }) {
  return (
    <div>
      <RankingDisplay routes={routes} />
    </div>
  );
}

export default HomePage;
