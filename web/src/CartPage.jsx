import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import CartPanel from "./CartPanel.jsx";

export default function CartPage() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/login" replace state={{ from: "/cart" }} />;
  }

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-cart-page container py-4 py-lg-5">
        {loading ? (
          <p className="text-center text-muted mb-0">Loading…</p>
        ) : (
          <CartPanel variant="page" />
        )}
      </main>
      <PublicSiteFooter />
    </div>
  );
}
