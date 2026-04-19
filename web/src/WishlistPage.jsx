import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import WishlistPanel from "./WishlistPanel.jsx";

export default function WishlistPage() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/login" replace state={{ from: "/wishlist" }} />;
  }

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-wishlist-page container py-4 py-lg-5">
        {loading ? (
          <p className="text-center text-muted mb-0">Loading…</p>
        ) : (
          <WishlistPanel variant="page" />
        )}
      </main>
      <PublicSiteFooter />
    </div>
  );
}
