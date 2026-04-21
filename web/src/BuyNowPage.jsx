import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { useShop } from "./ShopContext.jsx";
import { PRODUCT_IMAGE_PLACEHOLDER, formatRupeeInr, productImageSrc } from "./productUtils.js";

const BUY_NOW_STORAGE_KEY = "sand24-buyNow";

function sizeKey(s) {
  return String(s ?? "").trim();
}

function IconTrash({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readBuyNowPayload(locationState, numericId) {
  const st = locationState;
  if (st && (st.quantity != null || st.sizeLabel != null)) {
    return {
      quantity: Number(st.quantity),
      sizeLabel: String(st.sizeLabel ?? "").trim(),
    };
  }
  try {
    const raw = sessionStorage.getItem(BUY_NOW_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Number(p.productId) !== numericId) return null;
    return {
      quantity: Number(p.quantity),
      sizeLabel: String(p.sizeLabel ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export default function BuyNowPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { removeCartItem, updateCartItemQuantity, refresh } = useShop();

  const id = Number(productId);
  const seedPayload = useMemo(() => readBuyNowPayload(location.state, id), [location.state, id]);
  const storageConsumed = useRef(false);

  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [cartError, setCartError] = useState("");
  const [busyLineId, setBusyLineId] = useState(null);
  const [virtualQty, setVirtualQty] = useState(1);

  useEffect(() => {
    if (storageConsumed.current) return;
    if (!sessionStorage.getItem(BUY_NOW_STORAGE_KEY)) return;
    storageConsumed.current = true;
    sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: `/products/${productId}/buy-now` } });
    }
  }, [authLoading, user, navigate, productId]);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setLoadError("Invalid product.");
      setProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/products/${id}`);
        if (cancelled) return;
        const p = data?.data;
        if (!p) {
          setLoadError("Product not found.");
          setProduct(null);
          return;
        }
        setProduct(p);
        setLoadError("");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message || "Could not load product.");
          setProduct(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const stock = Math.max(0, Number(product.quantityAvailable) || 0);
    const q = seedPayload?.quantity;
    if (Number.isFinite(q) && q >= 1) {
      setVirtualQty(Math.min(Math.max(1, Math.floor(q)), stock > 0 ? stock : 1));
    } else {
      setVirtualQty(stock > 0 ? 1 : 0);
    }
  }, [product, seedPayload?.quantity]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/cart`);
        if (!cancelled) {
          setCartItems(data?.data || []);
          setCartError("");
        }
      } catch (e) {
        if (!cancelled) {
          setCartError(e.response?.data?.message || "Could not load cart.");
          setCartItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const effectiveSize = useMemo(() => {
    const list = Array.isArray(product?.sizes) ? product.sizes : [];
    const seed = seedPayload?.sizeLabel;
    if (list.length === 0) return "";
    if (seed && list.some((s) => String(s) === seed)) return seed;
    return String(list[0]);
  }, [product, seedPayload?.sizeLabel]);

  const stock = Math.max(0, Number(product?.quantityAvailable) || 0);
  const maxVirtual = stock > 0 ? stock : 1;

  const matchesCurrent = useCallback(
    (line) => line.productId === id && sizeKey(line.sizeLabel) === sizeKey(effectiveSize),
    [id, effectiveSize]
  );

  const currentCartLine = useMemo(() => cartItems.find((l) => matchesCurrent(l)) || null, [cartItems, matchesCurrent]);

  const otherCartLines = useMemo(() => cartItems.filter((l) => !matchesCurrent(l)), [cartItems, matchesCurrent]);

  const showVirtualCurrent = product && stock > 0 && !currentCartLine;

  const orderTotal = useMemo(() => {
    let t = 0;
    for (const line of otherCartLines) {
      t += (Number(line.finalPrice) || 0) * (Number(line.quantity) || 0);
    }
    if (currentCartLine) {
      t += (Number(currentCartLine.finalPrice) || 0) * (Number(currentCartLine.quantity) || 0);
    } else if (showVirtualCurrent && product) {
      t += (Number(product.finalPrice) || 0) * virtualQty;
    }
    return t;
  }, [otherCartLines, currentCartLine, showVirtualCurrent, product, virtualQty]);

  const canProceed =
    product &&
    stock > 0 &&
    (!Array.isArray(product.sizes) ||
      product.sizes.length === 0 ||
      sizeKey(effectiveSize) !== "");

  async function onRemoveLine(lineId) {
    setBusyLineId(lineId);
    try {
      await removeCartItem(lineId);
      setCartItems((prev) => prev.filter((x) => x.id !== lineId));
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusyLineId(null);
    }
  }

  async function bumpCartLine(line, delta) {
    const next = line.quantity + delta;
    if (next < 1) {
      await onRemoveLine(line.id);
      return;
    }
    setBusyLineId(line.id);
    try {
      const data = await updateCartItemQuantity(line.id, next);
      const applied = data?.quantity != null ? Number(data.quantity) : next;
      setCartItems((prev) =>
        prev.map((x) => (x.id === line.id ? { ...x, quantity: applied } : x))
      );
      await refresh();
    } catch {
      /* ignore */
    } finally {
      setBusyLineId(null);
    }
  }

  function bumpVirtual(delta) {
    setVirtualQty((q) => {
      const n = q + delta;
      if (n < 1) return 1;
      if (n > maxVirtual) return maxVirtual;
      return n;
    });
  }

  function handleProceed() {
    if (!canProceed) return;
    const lines = [];
    for (const line of otherCartLines) {
      lines.push({
        cartItemId: line.id,
        productId: line.productId,
        title: line.title,
        quantity: line.quantity,
        sizeLabel: line.sizeLabel || "",
        unitPrice: line.finalPrice,
        lineTotal: line.finalPrice * line.quantity,
      });
    }
    if (currentCartLine) {
      lines.push({
        cartItemId: currentCartLine.id,
        productId: currentCartLine.productId,
        title: product.title,
        quantity: currentCartLine.quantity,
        sizeLabel: effectiveSize || "",
        unitPrice: currentCartLine.finalPrice,
        lineTotal: currentCartLine.finalPrice * currentCartLine.quantity,
      });
    } else if (showVirtualCurrent) {
      lines.push({
        productId: id,
        title: product.title,
        quantity: virtualQty,
        sizeLabel: effectiveSize || "",
        unitPrice: Number(product.finalPrice) || 0,
        lineTotal: currentLinePrice(virtualQty),
      });
    }
    navigate("/checkout", {
      state: {
        lines,
        orderTotal,
        sourceProductId: id,
        fromBuyNow: true,
      },
    });
  }

  if (authLoading || !user) {
    return (
      <div className="website-home-page">
        <PublicSiteHeader />
        <main className="container py-5 text-center text-muted">Loading…</main>
        <PublicSiteFooter />
      </div>
    );
  }

  if (loadError && !product) {
    return (
      <div className="website-home-page">
        <PublicSiteHeader />
        <main className="website-buy-now-page container py-4 py-lg-5">
          <p className="text-danger" role="alert">
            {loadError}
          </p>
          <Link to="/products" className="website-cart-page__link">
            Back to products
          </Link>
        </main>
        <PublicSiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="website-home-page">
        <PublicSiteHeader />
        <main className="container py-5 text-center text-muted">Loading…</main>
        <PublicSiteFooter />
      </div>
    );
  }

  const currentLinePrice = (lineQty) => (Number(product.finalPrice) || 0) * lineQty;

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-buy-now-page container py-4 py-lg-5">
        <nav className="website-product-detail__breadcrumb small mb-3" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          <Link to={`/products/${id}`}>{product.title}</Link>
          <span aria-hidden> / </span>
          <span className="text-muted">Buy now</span>
        </nav>

        <h1 className="website-cart-page__title mb-4">Review order</h1>

        {cartError ? (
          <p className="text-danger small mb-3" role="alert">
            {cartError}
          </p>
        ) : null}

        {otherCartLines.length > 0 ? (
          <section className="website-buy-now-page__section mb-4" aria-labelledby="buy-now-cart-heading">
            <h2 id="buy-now-cart-heading" className="website-buy-now-page__section-title">
              In your cart
            </h2>
            <ul className="list-unstyled website-buy-now-page__cart-list mb-0">
              {otherCartLines.map((line) => (
                <li
                  key={line.id}
                  className="website-buy-now-page__card website-buy-now-page__card--compact mb-3"
                >
                  <div className="website-buy-now-page__row d-flex flex-wrap gap-3 align-items-start">
                    <Link to={`/products/${line.productId}`} className="website-cart-page__thumb-link flex-shrink-0">
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
                      {line.sizeLabel ? (
                        <p className="small text-muted mb-1">Size: {line.sizeLabel}</p>
                      ) : null}
                      <p className="small text-muted mb-0">Unit price {formatRupeeInr(line.finalPrice)}</p>
                    </div>
                    <div className="website-buy-now-page__controls text-lg-end">
                      <p className="website-cart-page__price mb-2">
                        {formatRupeeInr(line.finalPrice * line.quantity)}
                      </p>
                      <div className="website-buy-now-page__inline-actions">
                        <div className="website-buy-now-page__qty">
                          <button
                            type="button"
                            className="website-product-detail__qty-btn"
                            disabled={busyLineId === line.id}
                            onClick={() => bumpCartLine(line, -1)}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="website-product-detail__qty-value">{line.quantity}</span>
                          <button
                            type="button"
                            className="website-product-detail__qty-btn"
                            disabled={busyLineId === line.id}
                            onClick={() => bumpCartLine(line, 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="website-buy-now-page__remove-btn"
                          disabled={busyLineId === line.id}
                          onClick={() => onRemoveLine(line.id)}
                          aria-label="Remove from cart"
                        >
                          <IconTrash className="website-buy-now-page__remove-icon" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="website-buy-now-page__section mb-4" aria-labelledby="buy-now-current-heading">
          <h2 id="buy-now-current-heading" className="website-buy-now-page__section-title">
            {otherCartLines.length > 0 ? "This product" : "Your item"}
          </h2>

          <div className="website-buy-now-page__card">
            <div className="website-buy-now-page__row d-flex flex-wrap gap-3 align-items-start">
              <Link to={`/products/${id}`} className="website-cart-page__thumb-link flex-shrink-0">
                <img
                  src={productImageSrc(id, 1)}
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
                <Link to={`/products/${id}`} className="website-cart-page__product-title">
                  {product.title}
                </Link>
                {effectiveSize ? (
                  <p className="small text-muted mb-1">Size: {effectiveSize}</p>
                ) : null}
                <p className="small text-muted mb-0">Unit price {formatRupeeInr(product.finalPrice)}</p>
              </div>
              <div className="website-buy-now-page__controls text-lg-end">
                {stock <= 0 ? (
                  <p className="small text-danger mb-0">Out of stock</p>
                ) : currentCartLine ? (
                  <>
                    <p className="website-cart-page__price mb-2">
                      {formatRupeeInr(currentCartLine.finalPrice * currentCartLine.quantity)}
                    </p>
                    <div className="website-buy-now-page__inline-actions">
                      <div className="website-buy-now-page__qty">
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          disabled={busyLineId === currentCartLine.id}
                          onClick={() => bumpCartLine(currentCartLine, -1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="website-product-detail__qty-value">{currentCartLine.quantity}</span>
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          disabled={busyLineId === currentCartLine.id}
                          onClick={() => bumpCartLine(currentCartLine, 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="website-buy-now-page__remove-btn"
                        disabled={busyLineId === currentCartLine.id}
                        onClick={() => onRemoveLine(currentCartLine.id)}
                        aria-label="Remove from cart"
                      >
                        <IconTrash className="website-buy-now-page__remove-icon" />
                      </button>
                    </div>
                  </>
                ) : showVirtualCurrent ? (
                  <>
                    <p className="website-cart-page__price mb-2">{formatRupeeInr(currentLinePrice(virtualQty))}</p>
                    <div className="website-buy-now-page__inline-actions">
                      <div className="website-buy-now-page__qty">
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          onClick={() => bumpVirtual(-1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="website-product-detail__qty-value">{virtualQty}</span>
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          onClick={() => bumpVirtual(1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="website-buy-now-page__remove-btn"
                        onClick={() => navigate(`/products/${id}`)}
                        aria-label="Remove from order"
                      >
                        <IconTrash className="website-buy-now-page__remove-icon" />
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="website-buy-now-page__summary-footer">
          <div className="website-buy-now-page__action-stack">
            <div className="website-buy-now-page__total-line">
              <span className="website-buy-now-page__total-label">Total amount</span>
              <span className="website-buy-now-page__total-value">{formatRupeeInr(orderTotal)}</span>
            </div>
            <button
              type="button"
              className="btn website-product-detail__btn-cart website-buy-now-page__proceed"
              disabled={!canProceed}
              onClick={handleProceed}
            >
              Proceed
            </button>
            <Link to={`/products/${id}`} className="btn website-product-detail__btn-wish website-buy-now-page__back">
              Back to product
            </Link>
          </div>
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
