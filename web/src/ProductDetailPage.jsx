import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { useShop } from "./ShopContext.jsx";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  formatRsDecimals,
  formatRupeeInr,
  productHasImages,
  productImageSrc,
  productPrimaryImageSlot,
} from "./productUtils.js";

/** Hero image (yarn / fibre) — “Cotton” overlay; scales render below. */
const FABRIC_HERO_SRC = "/assets/images/product-fabric-yarn-hero.png";

const SIZE_CHART_SRC = "/assets/images/product-size-chart.jpg";

const DEFAULT_ATTRIBUTES = { stretch: 3, softness: 3, transparency: 2 };

const BUY_NOW_STORAGE_KEY = "sand24-buyNow";

function IconCheck({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FabricAttributeScale({ label, filled }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(filled) || 0)));
  return (
    <div className="website-product-detail__fabric-scale">
      <span className="website-product-detail__fabric-scale-label">{label}</span>
      <div className="website-product-detail__fabric-scale-track" role="img" aria-label={`${label}: ${n} of 5`}>
        <span className="website-product-detail__fabric-scale-line" aria-hidden />
        <div className="website-product-detail__fabric-scale-dots">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={i <= n ? "is-on" : ""} aria-hidden />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, addToWishlist, refresh } = useShop();
  const id = Number(productId);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [activeSlot, setActiveSlot] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [cartSaving, setCartSaving] = useState(false);
  const [wishSaving, setWishSaving] = useState(false);
  const [shopMessage, setShopMessage] = useState(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [duplicateCartOpen, setDuplicateCartOpen] = useState(false);
  const [duplicateWishlistOpen, setDuplicateWishlistOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [wishSuccess, setWishSuccess] = useState(false);
  const [relatedWishBusyId, setRelatedWishBusyId] = useState(null);

  useEffect(() => {
    setCartSuccess(false);
    setWishSuccess(false);
    setDuplicateCartOpen(false);
    setDuplicateWishlistOpen(false);
    setSizeChartOpen(false);
    setRelatedWishBusyId(null);
  }, [id]);

  useEffect(() => {
    if (!sizeChartOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") setSizeChartOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sizeChartOpen]);

  useEffect(() => {
    if (!cartSuccess) return undefined;
    const t = setTimeout(() => setCartSuccess(false), 2800);
    return () => clearTimeout(t);
  }, [cartSuccess]);

  useEffect(() => {
    if (!wishSuccess) return undefined;
    const t = setTimeout(() => setWishSuccess(false), 2800);
    return () => clearTimeout(t);
  }, [wishSuccess]);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setLoadError("Invalid product.");
      setProduct(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [detailRes, listRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/products/${id}`),
          axios.get(`${API_BASE_URL}/api/products`),
        ]);
        if (cancelled) return;
        const p = detailRes.data?.data;
        if (!p) {
          setLoadError("Product not found.");
          setProduct(null);
          return;
        }
        setProduct(p);
        setLoadError("");
        const slots = Array.isArray(p.imageSlots) && p.imageSlots.length > 0 ? p.imageSlots : [];
        setActiveSlot(slots.length ? slots[0] : 1);
        const avail = Math.max(0, Number(p.quantityAvailable) || 0);
        setQuantity(avail > 0 ? 1 : 0);
        const sizes = Array.isArray(p.sizes) ? p.sizes : [];
        setSelectedSize(sizes.length ? String(sizes[0]) : "");
        const all = listRes.data?.data || [];
        const label = p.categoryLabel;
        const others = all.filter((x) => x.id !== p.id);
        const sameCat = others.filter((x) => x.categoryLabel === label);
        const rest = others.filter((x) => x.categoryLabel !== label);
        setRelated([...sameCat, ...rest].slice(0, 8));
      } catch (e) {
        if (!cancelled) {
          if (e.response?.status === 404) {
            setLoadError("Product not found.");
          } else {
            setLoadError(e.response?.data?.message || "Could not load product.");
          }
          setProduct(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product?.id) return;
    const slots =
      Array.isArray(product.imageSlots) && product.imageSlots.length > 0 ? product.imageSlots : [];
    if (slots.length === 0) return;
    setActiveSlot((prev) => (slots.includes(prev) ? prev : slots[0]));
  }, [product?.id, product?.imageSlots]);

  const detailBlocks = useMemo(() => {
    if (!product) return [];
    const pairs = [
      ["Fabric", product.fabric],
      ["Colour", product.color],
      ["Print", product.printStyle],
      ["Body fit", product.bodyFit],
      ["Features", product.features],
      ["Neck type", product.neckType],
    ];
    return pairs.filter(([, v]) => String(v || "").trim());
  }, [product]);

  if (loadError && !product) {
    return (
      <div className="website-home-page website-home-page--product-detail">
        <PublicSiteHeader />
        <main className="website-product-detail">
          <div className="website-product-detail__column-frame container-fluid py-5">
            <p className="text-center mb-4" role="alert">
              {loadError}
            </p>
            <p className="text-center">
              <Link to="/products" className="website-product-detail__back-link">
                ← Back to all products
              </Link>
            </p>
          </div>
        </main>
        <PublicSiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="website-home-page website-home-page--product-detail">
        <PublicSiteHeader />
        <main className="website-product-detail">
          <div className="website-product-detail__column-frame container-fluid py-5 text-center text-muted">
            Loading…
          </div>
        </main>
        <PublicSiteFooter />
      </div>
    );
  }

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const imageSlots =
    Array.isArray(product.imageSlots) && product.imageSlots.length > 0 ? product.imageSlots : [];
  const galleryEmpty = imageSlots.length === 0;
  const gallerySingle = imageSlots.length === 1;

  const hasDiscount =
    product.offerPercent > 0 &&
    product.originalPrice > 0 &&
    product.originalPrice > product.finalPrice;

  const stock = Math.max(0, Number(product.quantityAvailable) || 0);
  const maxQty = stock > 0 ? stock : 1;
  const canPurchase =
    stock > 0 && (sizes.length === 0 || String(selectedSize || "").trim() !== "");

  function bumpQty(delta) {
    if (stock <= 0) return;
    setQuantity((q) => {
      const next = q + delta;
      if (next < 1) return 1;
      if (next > maxQty) return maxQty;
      return next;
    });
  }

  async function handleAddToCart() {
    if (!user) {
      setLoginPromptOpen(true);
      return;
    }
    if (!canPurchase) return;
    setCartSaving(true);
    setShopMessage(null);
    try {
      const data = await addToCart({
        productId: product.id,
        quantity,
        sizeLabel: sizes.length ? selectedSize : "",
      });
      await refresh();
      if (data?.alreadyInCart) {
        setDuplicateCartOpen(true);
        setCartSuccess(false);
        setWishSuccess(false);
        setShopMessage(null);
        return;
      }
      setCartSuccess(true);
      setWishSuccess(false);
      setShopMessage(null);
    } catch (e) {
      setCartSuccess(false);
      setShopMessage(e.response?.data?.message || "Could not add to cart.");
    } finally {
      setCartSaving(false);
    }
  }

  function handleBuyNow() {
    const sizeLabel = sizes.length ? selectedSize : "";
    const payload = { productId: id, quantity, sizeLabel };
    sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(payload));
    if (!user) {
      navigate("/login", { state: { from: `/products/${id}/buy-now` } });
      return;
    }
    if (!canPurchase) return;
    navigate(`/products/${id}/buy-now`, { state: { quantity, sizeLabel } });
  }

  async function handleAddToWishlist() {
    if (!user) {
      setLoginPromptOpen(true);
      return;
    }
    setWishSaving(true);
    setShopMessage(null);
    try {
      const data = await addToWishlist(product.id);
      await refresh();
      if (data?.alreadyHad) {
        setDuplicateWishlistOpen(true);
        setWishSuccess(false);
        setCartSuccess(false);
        setShopMessage(null);
        return;
      }
      setWishSuccess(true);
      setCartSuccess(false);
      setShopMessage(null);
    } catch (e) {
      setWishSuccess(false);
      setShopMessage(e.response?.data?.message || "Could not update wishlist.");
    } finally {
      setWishSaving(false);
    }
  }

  async function handleRelatedWishlist(relatedProductId) {
    if (!user) {
      setLoginPromptOpen(true);
      return;
    }
    setRelatedWishBusyId(relatedProductId);
    setShopMessage(null);
    try {
      const data = await addToWishlist(relatedProductId);
      await refresh();
      if (data?.alreadyHad) {
        setDuplicateWishlistOpen(true);
        return;
      }
      setShopMessage("Saved to wishlist.");
    } catch (e) {
      setShopMessage(e.response?.data?.message || "Could not update wishlist.");
    } finally {
      setRelatedWishBusyId(null);
    }
  }

  return (
    <div className="website-home-page website-home-page--product-detail">
      <PublicSiteHeader />

      <main className="website-product-detail">
        <div className="website-product-detail__column-frame container-fluid px-3 px-lg-4 py-3 py-lg-4">
          <nav className="website-product-detail__breadcrumb small mb-2 mb-lg-3" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden> / </span>
            <Link to="/products">Products</Link>
            <span aria-hidden> / </span>
            <span className="text-muted">{product.title}</span>
          </nav>

          <button
            type="button"
            className="btn btn-link website-product-detail__back px-0 mb-3"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <div className="row g-4 g-xl-5 align-items-start website-product-detail__top">
            <div className="col-12 col-lg-7">
              <div
                className={`website-product-detail__gallery${gallerySingle ? " website-product-detail__gallery--single" : ""}${galleryEmpty ? " website-product-detail__gallery--empty" : ""}`}
              >
                {!galleryEmpty ? (
                  <div className="website-product-detail__thumbs" role="tablist" aria-label="Product images">
                    {imageSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`website-product-detail__thumb${activeSlot === slot ? " is-active" : ""}`}
                        onClick={() => setActiveSlot(slot)}
                        aria-pressed={activeSlot === slot}
                        aria-label={`Image ${slot}`}
                      >
                        <img
                          src={productImageSrc(product.id, slot)}
                          alt=""
                          className="website-product-detail__thumb-img"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="website-product-detail__main">
                  {galleryEmpty ? (
                    <div className="website-product-detail__placeholder" role="img" aria-label="No product photo">
                      No image
                    </div>
                  ) : (
                    <img
                      src={productImageSrc(product.id, activeSlot)}
                      alt={product.title}
                      className="website-product-detail__main-img"
                      decoding="async"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5 website-product-detail__right">
              <div className="website-product-detail__buy">
                <p className="website-product-detail__category small mb-2">{product.categoryLabel}</p>
                <h1 className="website-product-detail__title website-product-detail__title--display">{product.title}</h1>

                <div className="website-product-detail__price-block mb-2">
                  <p className="website-product-detail__price-hero mb-0">{formatRsDecimals(product.finalPrice)}</p>
                  {hasDiscount ? (
                    <p className="website-product-detail__price-sub mb-0">
                      Regular price {formatRsDecimals(product.originalPrice)} — {product.offerPercent}% off
                    </p>
                  ) : null}
                </div>

                {sizes.length > 0 ? (
                  <div className="website-product-detail__field mb-3">
                    <div className="website-product-detail__field-head">
                      <span className="website-product-detail__field-label">Select size</span>
                      <button
                        type="button"
                        className="website-product-detail__size-chart"
                        aria-haspopup="dialog"
                        aria-expanded={sizeChartOpen}
                        aria-controls="product-size-chart-dialog"
                        onClick={() => setSizeChartOpen(true)}
                      >
                        Size chart
                      </button>
                    </div>
                    <select
                      className="form-select website-product-detail__select"
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      aria-label="Size"
                    >
                      {sizes.map((s) => (
                        <option key={String(s)} value={String(s)}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="website-product-detail__field mb-4">
                  <span className="website-product-detail__field-label d-block mb-2">Quantity</span>
                  {stock <= 0 ? (
                    <p className="website-product-detail__oos mb-0">Out of stock</p>
                  ) : (
                    <div className="website-product-detail__qty-row">
                      <div className="website-product-detail__qty">
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          onClick={() => bumpQty(-1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="website-product-detail__qty-value">{quantity}</span>
                        <button
                          type="button"
                          className="website-product-detail__qty-btn"
                          onClick={() => bumpQty(1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn website-product-detail__btn-cart website-product-detail__btn-cart--buynow-inline"
                        disabled={!canPurchase}
                        onClick={handleBuyNow}
                      >
                        Buy now
                      </button>
                    </div>
                  )}
                </div>

                <div className="website-product-detail__actions">
                  <button
                    type="button"
                    className={`btn website-product-detail__btn-cart w-100${cartSuccess ? " website-product-detail__btn-cart--success" : ""}`}
                    disabled={!canPurchase || cartSaving}
                    onClick={handleAddToCart}
                  >
                    {cartSaving ? (
                      "Please wait…"
                    ) : cartSuccess ? (
                      <span className="website-product-detail__btn-success-inner">
                        <IconCheck className="website-product-detail__btn-check" />
                        <span>Added</span>
                      </span>
                    ) : (
                      "Add to Cart"
                    )}
                  </button>
                  <button
                    type="button"
                    className={`btn website-product-detail__btn-wish w-100${wishSuccess ? " website-product-detail__btn-wish--success" : ""}`}
                    disabled={wishSaving}
                    onClick={handleAddToWishlist}
                  >
                    {wishSaving ? (
                      "Please wait…"
                    ) : wishSuccess ? (
                      <span className="website-product-detail__btn-success-inner">
                        <IconCheck className="website-product-detail__btn-check" />
                        <span>Saved</span>
                      </span>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M12 21s-7-4.35-7-9.5a4.5 4.5 0 0 1 8.06-2.75A4.5 4.5 0 0 1 19 11.5C19 16.65 12 21 12 21z"
                            stroke="currentColor"
                            strokeWidth="1.45"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Add to Wishlist
                      </>
                    )}
                  </button>
                </div>

                <div className="website-product-detail__fabric-hero website-product-detail__fabric-hero--after-wishlist">
                  <img
                    src={FABRIC_HERO_SRC}
                    alt=""
                    className="website-product-detail__fabric-hero-img"
                    width={581}
                    height={298}
                    decoding="async"
                  />
                  <span className="website-product-detail__fabric-cursive">Cotton</span>
                </div>

                {shopMessage ? (
                  <p className="website-product-detail__shop-msg small mb-4" role="status">
                    {shopMessage}
                  </p>
                ) : null}
              </div>

              <div className="website-product-detail__fabric-block website-product-detail__fabric-block--scales">
                <div className="website-product-detail__fabric-scales">
                  <FabricAttributeScale label="Stretch" filled={DEFAULT_ATTRIBUTES.stretch} />
                  <FabricAttributeScale label="Softness" filled={DEFAULT_ATTRIBUTES.softness} />
                  <FabricAttributeScale label="Transparency" filled={DEFAULT_ATTRIBUTES.transparency} />
                </div>
              </div>

              {detailBlocks.length > 0 ? (
                <section className="website-product-detail__specs-section website-product-detail__specs-section--right" aria-labelledby="detail-specs-heading">
                  <h2 id="detail-specs-heading" className="visually-hidden">
                    Product specifications
                  </h2>
                  <dl className="row website-product-detail__spec-grid mb-0">
                    {detailBlocks.map(([k, v]) => (
                      <div key={k} className="col-12 col-sm-6 website-product-detail__spec-cell">
                        <dt className="website-product-detail__dt">{k}</dt>
                        <dd className="website-product-detail__dd mb-0">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {String(product.productDetails || "").trim() ? (
                <section className="website-product-detail__text-block" aria-labelledby="product-details-block-heading">
                  <h2 id="product-details-block-heading" className="website-product-detail__block-title">
                    Product details
                  </h2>
                  <div className="website-product-detail__prose">{product.productDetails}</div>
                </section>
              ) : null}

              {String(product.shipmentDelivery || "").trim() ? (
                <section className="website-product-detail__text-block" aria-labelledby="shipment-block-heading">
                  <h2 id="shipment-block-heading" className="website-product-detail__block-title">
                    Shipment and delivery
                  </h2>
                  <div className="website-product-detail__prose">{product.shipmentDelivery}</div>
                </section>
              ) : null}

              {String(product.returnExchange || "").trim() ? (
                <section className="website-product-detail__text-block" aria-labelledby="return-block-heading">
                  <h2 id="return-block-heading" className="website-product-detail__block-title">
                    Return and exchange
                  </h2>
                  <div className="website-product-detail__prose">{product.returnExchange}</div>
                </section>
              ) : null}
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section
            className="website-home-section website-product-detail__related website-home-page__pre-footer-band"
            aria-labelledby="related-heading"
          >
            <div className="website-product-detail__column-frame container-fluid px-3 px-lg-4">
              <h2 id="related-heading" className="website-products-catalog__heading text-center mb-4">
                Related products
              </h2>
              <div className="row row-cols-2 row-cols-lg-4 g-3 g-lg-4 website-home-products__grid website-product-detail__related-grid">
                {related.map((p) => (
                  <div key={p.id} className="col">
                    <article className="website-product-card website-product-card--related d-flex flex-column h-100">
                      <div className="website-product-card__media-wrap">
                        <Link to={`/products/${p.id}`} className="website-product-card__media">
                          <img
                            src={
                              productHasImages(p)
                                ? productImageSrc(p.id, productPrimaryImageSlot(p))
                                : PRODUCT_IMAGE_PLACEHOLDER
                            }
                            alt={p.title}
                            className="website-product-card__img"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                            }}
                          />
                        </Link>
                        <button
                          type="button"
                          className="website-product-card__wish-btn"
                          aria-label={`Add ${p.title} to wishlist`}
                          disabled={relatedWishBusyId === p.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void handleRelatedWishlist(p.id);
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M12 21s-7-4.35-7-9.5a4.5 4.5 0 0 1 8.06-2.75A4.5 4.5 0 0 1 19 11.5C19 16.65 12 21 12 21z"
                              stroke="currentColor"
                              strokeWidth="1.45"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="website-product-card__title-row">
                        <h3 className="website-product-card__title website-product-card__title--related mb-0">
                          <Link to={`/products/${p.id}`} className="website-product-card__title-link">
                            {p.title}
                          </Link>
                        </h3>
                        {p.offerPercent > 0 && p.originalPrice > 0 && p.originalPrice > p.finalPrice ? (
                          <span className="website-product-card__meta-badge" aria-hidden>
                            −{p.offerPercent}%
                          </span>
                        ) : null}
                      </div>
                      <div className="website-product-card__prices website-product-card__prices--related mt-auto">
                        {p.offerPercent > 0 && p.originalPrice > 0 && p.originalPrice > p.finalPrice ? (
                          <>
                            <span className="website-product-card__price website-product-card__price--original">
                              {formatRupeeInr(p.originalPrice)}
                            </span>
                            <span className="website-product-card__price website-product-card__price--final">
                              {formatRupeeInr(p.finalPrice)}
                            </span>
                          </>
                        ) : (
                          <span className="website-product-card__price website-product-card__price--final">
                            {formatRupeeInr(p.finalPrice)}
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                ))}
              </div>

              <div className="website-product-detail__brand-strip text-center mt-5 pt-3">
                <p className="website-intro-cta__tagline website-product-detail__brand-script mb-2">
                  Better for you Better for planet
                </p>
                <p className="website-product-detail__brand-headline mb-0">
                  Sand 24 specialises in designing and manufacturing clothing with care for craft and the planet.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="website-home-section website-product-detail__related website-home-page__pre-footer-band">
            <div className="website-product-detail__column-frame container-fluid px-3 px-lg-4 pb-5">
              <div className="website-product-detail__brand-strip text-center">
                <p className="website-intro-cta__tagline website-product-detail__brand-script mb-2">
                  Better for you Better for planet
                </p>
                <p className="website-product-detail__brand-headline mb-0">
                  Sand 24 specialises in designing and manufacturing clothing with care for craft and the planet.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {loginPromptOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setLoginPromptOpen(false)}
        >
          <div
            className="website-auth-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pd-login-prompt-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="pd-login-prompt-title" className="website-auth-modal__text mb-0">
              Sign in to add items to your cart and wishlist. Your selections are saved to your account.
            </p>
            <Link
              to="/login"
              state={{ from: `/products/${productId}` }}
              className="btn website-auth-submit w-100 mt-3"
              onClick={() => setLoginPromptOpen(false)}
            >
              Sign in
            </Link>
            <button
              type="button"
              className="btn btn-link w-100 mt-2"
              onClick={() => setLoginPromptOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {duplicateCartOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setDuplicateCartOpen(false)}
        >
          <div
            className="website-auth-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pd-dup-cart-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="pd-dup-cart-title" className="website-auth-modal__text mb-0">
              This item is already in your cart. Open your cart to change quantity.
            </p>
            <Link
              to="/cart"
              className="btn website-auth-submit w-100 mt-3"
              onClick={() => setDuplicateCartOpen(false)}
            >
              View cart
            </Link>
            <button
              type="button"
              className="btn btn-link w-100 mt-2"
              onClick={() => setDuplicateCartOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {duplicateWishlistOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setDuplicateWishlistOpen(false)}
        >
          <div
            className="website-auth-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pd-dup-wish-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="pd-dup-wish-title" className="website-auth-modal__text mb-0">
              This item is already on your wishlist.
            </p>
            <Link
              to="/wishlist"
              className="btn website-auth-submit w-100 mt-3"
              onClick={() => setDuplicateWishlistOpen(false)}
            >
              View wishlist
            </Link>
            <button
              type="button"
              className="btn btn-link w-100 mt-2"
              onClick={() => setDuplicateWishlistOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {sizeChartOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setSizeChartOpen(false)}
        >
          <div
            className="website-product-detail__size-chart-modal"
            id="product-size-chart-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-size-chart-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="website-product-detail__size-chart-modal-toolbar">
              <h2 id="product-size-chart-title" className="visually-hidden">
                Size guide
              </h2>
              <button
                type="button"
                className="website-auth-modal__close website-product-detail__size-chart-modal-close"
                aria-label="Close size guide"
                onClick={() => setSizeChartOpen(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <div className="website-product-detail__size-chart-modal-body">
              <img
                src={SIZE_CHART_SRC}
                alt="Size guide: body measurements in inches for XS through XL"
                className="website-product-detail__size-chart-img"
                width={1024}
                height={566}
                decoding="async"
              />
            </div>
          </div>
        </div>
      ) : null}

      <PublicSiteFooter />
    </div>
  );
}
