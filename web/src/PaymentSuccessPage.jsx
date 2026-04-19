import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

/** Kept for direct URLs / bookmarks: forwards to account → Orders with the same confirmation state. */
export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hasOrderInfo = Boolean(location.state?.orderId ?? location.state?.merchantOrderId);
    navigate(
      {
        pathname: "/profile",
        search: "?tab=orders",
      },
      {
        replace: true,
        state: {
          tab: "orders",
          ...(hasOrderInfo
            ? {
                paymentSuccess: true,
                orderId: location.state?.orderId,
                merchantOrderId: location.state?.merchantOrderId,
              }
            : {}),
        },
      }
    );
  }, [navigate, location.state]);

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-checkout-page website-checkout-page__main container py-5 text-center">
        <p className="text-muted mb-0">Opening your account…</p>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
