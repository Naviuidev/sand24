import { Link, useLocation } from "react-router-dom";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function PaymentPendingPage() {
  const location = useLocation();
  const merchantOrderId = location.state?.merchantOrderId;

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-checkout-page website-checkout-page__main container py-5">
        <div className="website-checkout-page__panel mx-auto" style={{ maxWidth: "32rem" }}>
          <h1 className="website-cart-page__title h4 mb-3">Payment pending</h1>
          <p className="mb-2">
            We have not received a final confirmation from the bank yet. If money was debited, it is usually reconciled
            within a few minutes.
          </p>
          {merchantOrderId ? (
            <p className="small text-muted mb-4 text-break">
              Reference: <strong>{merchantOrderId}</strong>
            </p>
          ) : (
            <p className="small text-muted mb-4">Keep your transaction reference from PhonePe handy.</p>
          )}
          <div className="d-flex flex-wrap gap-2">
            <Link to="/" className="btn website-product-detail__btn-cart">
              Home
            </Link>
            <Link to="/products" className="btn website-product-detail__btn-wish">
              Products
            </Link>
          </div>
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
