import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { useShop } from "./ShopContext.jsx";
import { PRODUCT_IMAGE_PLACEHOLDER, formatRupeeInr, productImageSrc } from "./productUtils.js";

/**
 * Cart line list (shared by /cart and profile tab). Requires authenticated user.
 */
export default function CartPanel({ variant = "page" }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { removeCartItem, refresh, updateCartItemQuantity } = useShop();
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [qtyBusyId, setQtyBusyId] = useState(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/cart`);
        if (!cancelled) {
          setItems(data?.data || []);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message || "Could not load cart.");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const grandTotal = useMemo(() => {
    return items.reduce((sum, line) => {
      const unit = Number(line.finalPrice) || 0;
      const qty = Number(line.quantity) || 0;
      return sum + unit * qty;
    }, 0);
  }, [items]);

  const checkoutPayload = useMemo(() => {
    if (!items.length) return { lines: [], orderTotal: 0 };
    const lines = items.map((line) => {
      const unit = Number(line.finalPrice) || 0;
      const qty = Number(line.quantity) || 0;
      return {
        cartItemId: line.id,
        productId: line.productId,
        title: line.title,
        quantity: qty,
        sizeLabel: line.sizeLabel || "",
        unitPrice: unit,
        lineTotal: unit * qty,
      };
    });
    const orderTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    return { lines, orderTotal };
  }, [items]);

  async function onRemove(id) {
    setBusyId(id);
    try {
      await removeCartItem(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  }

  async function onChangeQuantity(line, delta) {
    const q = Number(line.quantity) || 0;
    const next = q + delta;
    if (next < 1) return;
    setQtyBusyId(line.id);
    try {
      const result = await updateCartItemQuantity(line.id, next);
      if (result?.deleted) {
        setItems((prev) => prev.filter((x) => x.id !== line.id));
      } else if (result?.quantity != null) {
        setItems((prev) =>
          prev.map((x) => (x.id === line.id ? { ...x, quantity: result.quantity } : x))
        );
      }
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setQtyBusyId(null);
    }
  }

  if (authLoading || !user) {
    return <p className="text-center text-muted mb-0">Loading…</p>;
  }

  const titleClass =
    variant === "profile" ? "customer-profile-section__title mb-3" : "website-cart-page__title mb-4";

  function goToCheckout() {
    if (!checkoutPayload.lines.length) return;
    navigate("/checkout", {
      state: {
        lines: checkoutPayload.lines,
        orderTotal: checkoutPayload.orderTotal,
      },
    });
  }

  return (
    <div className={variant === "profile" ? "customer-profile-embed customer-profile-embed--cart" : undefined}>
      {variant === "page" ? (
        <h1 className={titleClass}>Shopping cart</h1>
      ) : (
        <h2 className={titleClass}>Shopping cart</h2>
      )}
      {loadError ? (
        <p className="text-danger" role="alert">
          {loadError}
        </p>
      ) : null}
      {items.length === 0 && !loadError ? (
        <p className="text-muted">
          Your cart is empty.{" "}
          <Link to="/products" className="website-cart-page__link">
            Browse products
          </Link>
        </p>
      ) : (
        <ul className="list-unstyled website-cart-page__list mb-0">
          {items.map((line) => (
            <li
              key={line.id}
              className="website-cart-page__row d-flex flex-wrap gap-3 align-items-center py-3 border-bottom"
            >
              <Link to={`/products/${line.productId}`} className="website-cart-page__thumb-link">
                <img
                  src={productImageSrc(line.productId, 1)}
                  onError={(e) => {
                    e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                  }}
                  alt=""
                  className="website-cart-page__thumb"
                  width={88}
                  height={110}
                />
              </Link>
              <div className="flex-grow-1 min-width-0">
                <Link to={`/products/${line.productId}`} className="website-cart-page__product-title">
                  {line.title}
                </Link>
                {line.sizeLabel ? <p className="small text-muted mb-0">Size: {line.sizeLabel}</p> : null}
              </div>
              <div className="text-end website-cart-page__row-actions">
                <p className="website-cart-page__price mb-2">
                  {formatRupeeInr((Number(line.finalPrice) || 0) * (Number(line.quantity) || 0))}
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-end align-items-center">
                  <div className="website-cart-page__qty" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      className="website-cart-page__qty-btn"
                      aria-label="Decrease quantity"
                      disabled={
                        qtyBusyId === line.id ||
                        busyId === line.id ||
                        (Number(line.quantity) || 0) <= 1
                      }
                      onClick={() => onChangeQuantity(line, -1)}
                    >
                      −
                    </button>
                    <span className="website-cart-page__qty-value" aria-live="polite">
                      {Number(line.quantity) || 0}
                    </span>
                    <button
                      type="button"
                      className="website-cart-page__qty-btn"
                      aria-label="Increase quantity"
                      disabled={qtyBusyId === line.id || busyId === line.id}
                      onClick={() => onChangeQuantity(line, 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={busyId === line.id || qtyBusyId === line.id}
                    onClick={() => onRemove(line.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && !loadError ? (
        <div className="website-cart-page__grand-total d-flex justify-content-between align-items-baseline gap-3 flex-wrap mt-4 pt-4 border-top">
          <span className="website-cart-page__grand-total-label">Grand total</span>
          <span className="website-cart-page__grand-total-value">{formatRupeeInr(grandTotal)}</span>
        </div>
      ) : null}
      {items.length > 0 && !loadError ? (
        <div className="website-cart-page__actions mt-3 d-flex flex-column justify-content-end flex-sm-row flex-wrap gap-3 align-items-stretch align-items-sm-center">
          <button
            type="button"
            className="btn website-product-detail__btn-cart"
            onClick={goToCheckout}
          >
            Buy now
          </button>
          <Link to="/products" className="website-cart-page__back-products">
            Back to products
          </Link>
        </div>
      ) : null}
    </div>
  );
}
