import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { useShop } from "./ShopContext.jsx";
import { PRODUCT_IMAGE_PLACEHOLDER, formatRupeeInr, productImageSrc } from "./productUtils.js";

/**
 * Wishlist grid (shared by /wishlist and profile tab). Requires authenticated user.
 */
export default function WishlistPanel({ variant = "page" }) {
  const { user, loading: authLoading } = useAuth();
  const { removeFromWishlist, refresh } = useShop();
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/wishlist`);
        if (!cancelled) {
          setItems(data?.data || []);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message || "Could not load wishlist.");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function onRemove(productId) {
    setBusyId(productId);
    try {
      await removeFromWishlist(productId);
      setItems((prev) => prev.filter((x) => x.productId !== productId));
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !user) {
    return <p className="text-center text-muted mb-0">Loading…</p>;
  }

  const titleClass =
    variant === "profile" ? "customer-profile-section__title mb-3" : "website-wishlist-page__title mb-4";

  return (
    <div className={variant === "profile" ? "customer-profile-embed customer-profile-embed--wishlist" : undefined}>
      {variant === "page" ? (
        <h1 className={titleClass}>Wishlist</h1>
      ) : (
        <h2 className={titleClass}>Wishlist</h2>
      )}
      {loadError ? (
        <p className="text-danger" role="alert">
          {loadError}
        </p>
      ) : null}
      {items.length === 0 && !loadError ? (
        <p className="text-muted">
          No saved items yet.{" "}
          <Link to="/products" className="website-wishlist-page__link">
            Explore the collection
          </Link>
        </p>
      ) : (
        <ul className="list-unstyled row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-4 mb-0">
          {items.map((line) => (
            <li key={line.productId} className="col">
              <article className="website-product-card h-100 d-flex flex-column">
                <Link to={`/products/${line.productId}`} className="website-product-card__media">
                  <img
                    src={productImageSrc(line.productId, 1)}
                    onError={(e) => {
                      e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                    }}
                    alt={line.title}
                    className="website-product-card__img"
                    loading="lazy"
                  />
                </Link>
                <h3 className="website-product-card__title h6 flex-grow-1">
                  <Link to={`/products/${line.productId}`} className="website-product-card__title-link">
                    {line.title}
                  </Link>
                </h3>
                <p className="website-product-card__price website-product-card__price--final mb-2">
                  {formatRupeeInr(line.finalPrice)}
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mt-auto align-self-start"
                  disabled={busyId === line.productId}
                  onClick={() => onRemove(line.productId)}
                >
                  Remove
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
