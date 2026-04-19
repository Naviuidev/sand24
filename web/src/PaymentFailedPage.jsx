import { Link, useLocation } from "react-router-dom";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function PaymentFailedPage() {
  const location = useLocation();
  const message = location.state?.message || "Your payment could not be completed.";

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-checkout-page website-checkout-page__main container py-5">
        <div className="website-checkout-page__panel mx-auto" style={{ maxWidth: "32rem" }}>
          <h1 className="website-cart-page__title h4 mb-3 text-danger">Payment failed</h1>
          <p className="mb-4">{message}</p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/checkout" className="btn website-product-detail__btn-cart">
              Try again
            </Link>
            <Link to="/products" className="btn website-product-detail__btn-wish">
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
