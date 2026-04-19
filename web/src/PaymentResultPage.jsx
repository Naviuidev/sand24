import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";

export default function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/payment/result" + window.location.search } });
      return;
    }

    const merchantOrderId = searchParams.get("merchantOrderId");
    if (!merchantOrderId) {
      navigate("/payment/failed", { replace: true, state: { message: "Missing payment reference." } });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/api/me/payment/finalize?merchantOrderId=${encodeURIComponent(merchantOrderId)}`
        );
        if (cancelled) return;
        const outcome = data?.outcome;
        const payload = {
          orderId: data?.orderId,
          merchantOrderId: data?.merchantOrderId || merchantOrderId,
        };
        if (outcome === "paid") {
          await refreshUser?.();
          navigate(
            {
              pathname: "/profile",
              search: "?tab=orders",
            },
            {
              replace: true,
              state: {
                tab: "orders",
                paymentSuccess: true,
                orderId: payload.orderId,
                merchantOrderId: payload.merchantOrderId,
              },
            }
          );
        } else if (outcome === "failed") {
          navigate("/payment/failed", { replace: true, state: payload });
        } else {
          navigate("/payment/pending", { replace: true, state: payload });
        }
      } catch (e) {
        if (!cancelled) {
          navigate("/payment/failed", {
            replace: true,
            state: { message: e.response?.data?.message || "Could not verify payment." },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, searchParams, refreshUser]);

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-checkout-page website-checkout-page__main container py-5 text-center">
        <p className="text-muted mb-0">Confirming payment…</p>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
