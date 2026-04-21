import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  formatRupeeInr,
  productHasImages,
  productImageSrc,
  productPrimaryImageSlot,
} from "./productUtils.js";

const PRODUCTS_HERO_BG = "/assets/images/products-hero-bg.png";

function toggleInSet(set, key) {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const categoryIdFromUrl = useMemo(() => {
    const raw = searchParams.get("category");
    if (!raw || !/^\d+$/.test(String(raw).trim())) return null;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const searchQueryFromUrl = useMemo(() => {
    const raw = searchParams.get("q") ?? searchParams.get("search");
    if (raw == null) return "";
    return String(raw).trim();
  }, [searchParams]);

  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [categoryTitleFallback, setCategoryTitleFallback] = useState(null);
  const [checkedCategories, setCheckedCategories] = useState(() => new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (categoryIdFromUrl == null) {
      setCategoryTitleFallback(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/categories`);
        const list = res.data?.data || [];
        const c = list.find((x) => x.id === categoryIdFromUrl);
        if (!cancelled) {
          setCategoryTitleFallback(c ? `${c.audienceLabel} — ${c.name}` : null);
        }
      } catch {
        if (!cancelled) setCategoryTitleFallback(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryIdFromUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = {};
        if (categoryIdFromUrl != null) params.categoryId = String(categoryIdFromUrl);
        if (searchQueryFromUrl.length > 0) params.q = searchQueryFromUrl;
        const res = await axios.get(`${API_BASE_URL}/api/products`, {
          params: Object.keys(params).length ? params : undefined,
        });
        const data = res.data?.data || [];
        if (!cancelled) {
          setProducts(data);
          setLoadError("");
          const labels = [...new Set(data.map((p) => p.categoryLabel).filter(Boolean))];
          setCheckedCategories(new Set(labels));
          if (data.length) {
            const prices = data.map((p) => Number(p.finalPrice) || 0);
            setPriceMin(String(Math.floor(Math.min(...prices))));
            setPriceMax(String(Math.ceil(Math.max(...prices))));
          } else {
            setPriceMin("");
            setPriceMax("");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setProducts([]);
          setLoadError(e.response?.data?.message || "Could not load products.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryIdFromUrl, searchQueryFromUrl]);

  const catalogHeadingText = useMemo(() => {
    if (searchQueryFromUrl.length > 0) {
      return `Search results for “${searchQueryFromUrl}”`;
    }
    if (categoryIdFromUrl == null) return "All products";
    if (products.length > 0) return products[0].categoryLabel;
    return categoryTitleFallback || "Products";
  }, [categoryIdFromUrl, products, categoryTitleFallback, searchQueryFromUrl]);

  const categoryLabels = useMemo(
    () => [...new Set(products.map((p) => p.categoryLabel).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    ),
    [products]
  );

  const filteredSorted = useMemo(() => {
    let list = products.filter((p) => checkedCategories.has(p.categoryLabel));
    const mn = priceMin === "" ? -Infinity : Number(priceMin);
    const mx = priceMax === "" ? Infinity : Number(priceMax);
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
      return list;
    }
    list = list.filter((p) => {
      const fp = Number(p.finalPrice) || 0;
      return fp >= mn && fp <= mx;
    });
    const sorted = [...list];
    if (sortBy === "price-asc") {
      sorted.sort((a, b) => (Number(a.finalPrice) || 0) - (Number(b.finalPrice) || 0));
    } else if (sortBy === "price-desc") {
      sorted.sort((a, b) => (Number(b.finalPrice) || 0) - (Number(a.finalPrice) || 0));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  }, [products, checkedCategories, priceMin, priceMax, sortBy]);

  const allCategoriesChecked = categoryLabels.length > 0 && categoryLabels.every((l) => checkedCategories.has(l));

  function selectAllCategories() {
    setCheckedCategories(new Set(categoryLabels));
  }

  function clearAllCategories() {
    setCheckedCategories(new Set());
  }

  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <section className="website-products-hero" aria-label="Products">
        <div className="website-products-hero__inner">
          <img
            src={PRODUCTS_HERO_BG}
            alt=""
            className="website-products-hero__img"
            decoding="async"
          />
          <div className="website-products-hero__overlay" aria-hidden />
          <div className="website-products-hero__text container text-center">
            <h1 className="website-products-hero__title">Our Collection</h1>
            <p className="website-products-hero__subtitle">
              Handwoven textures and timeless silhouettes — made to last beyond the season.
            </p>
          </div>
        </div>
      </section>

      <section className="website-home-section website-products-catalog" aria-labelledby="products-catalog-heading">
        <div className="container-fluid website-products-catalog__wrap px-3 px-lg-4">
          <h2
            id="products-catalog-heading"
            className={`website-products-catalog__heading text-center${
              categoryIdFromUrl != null || searchQueryFromUrl.length > 0
                ? " website-products-catalog__heading--filtered"
                : ""
            }`}
          >
            {catalogHeadingText}
          </h2>
          {categoryIdFromUrl != null || searchQueryFromUrl.length > 0 ? (
            <p className="text-center mb-3">
              <Link
                to={
                  categoryIdFromUrl != null && searchQueryFromUrl.length > 0
                    ? `/products?q=${encodeURIComponent(searchQueryFromUrl)}`
                    : "/products"
                }
                className="website-products-catalog__view-all-link"
              >
                {searchQueryFromUrl.length > 0 && categoryIdFromUrl != null
                  ? "Clear category filter"
                  : searchQueryFromUrl.length > 0
                    ? "Clear search"
                    : "View all products"}
              </Link>
            </p>
          ) : null}

          {loadError ? (
            <p className="text-center text-danger mb-0" role="alert">
              {loadError}
            </p>
          ) : null}

          <div className="row g-4 website-products-catalog__layout">
            <aside className="col-12 col-lg-3">
              <div className="website-products-filters d-lg-block">
                <details className="website-products-filters__mobile d-lg-none mb-3">
                  <summary className="website-products-filters__summary">Filters &amp; sort</summary>
                  <div className="website-products-filters__body pt-3">
                    <FilterControls
                      categoryLabels={categoryLabels}
                      checkedCategories={checkedCategories}
                      setCheckedCategories={setCheckedCategories}
                      allCategoriesChecked={allCategoriesChecked}
                      selectAllCategories={selectAllCategories}
                      clearAllCategories={clearAllCategories}
                      priceMin={priceMin}
                      priceMax={priceMax}
                      setPriceMin={setPriceMin}
                      setPriceMax={setPriceMax}
                      sortBy={sortBy}
                      setSortBy={setSortBy}
                    />
                  </div>
                </details>
                <div className="d-none d-lg-block website-products-filters__desktop">
                  <h3 className="website-products-filters__heading">Filter</h3>
                  <FilterControls
                    categoryLabels={categoryLabels}
                    checkedCategories={checkedCategories}
                    setCheckedCategories={setCheckedCategories}
                    allCategoriesChecked={allCategoriesChecked}
                    selectAllCategories={selectAllCategories}
                    clearAllCategories={clearAllCategories}
                    priceMin={priceMin}
                    priceMax={priceMax}
                    setPriceMin={setPriceMin}
                    setPriceMax={setPriceMax}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                  />
                </div>
              </div>
            </aside>

            <div className="col-12 col-lg-9">
              <p className="website-products-count small text-muted mb-3">
                Showing {filteredSorted.length} of {products.length} products
              </p>
              {filteredSorted.length === 0 && !loadError ? (
                <p className="website-home-products__empty text-center mb-0">No products match these filters.</p>
              ) : (
                <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-4 website-home-products__grid">
                  {filteredSorted.map((p) => (
                    <div key={p.id} className="col">
                      <article className="website-product-card">
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
                        <h3 className="website-product-card__title">{p.title}</h3>
                        <div className="website-product-card__prices">
                          {p.offerPercent > 0 &&
                          p.originalPrice > 0 &&
                          p.originalPrice > p.finalPrice ? (
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
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </div>
  );
}

function FilterControls({
  categoryLabels,
  checkedCategories,
  setCheckedCategories,
  allCategoriesChecked,
  selectAllCategories,
  clearAllCategories,
  priceMin,
  priceMax,
  setPriceMin,
  setPriceMax,
  sortBy,
  setSortBy,
}) {
  return (
    <>
      <div className="website-products-filters__group mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="website-products-filters__label">Category</span>
          <div className="btn-group btn-group-sm" role="group" aria-label="Category selection">
            <button
              type="button"
              className="btn btn-outline-secondary website-products-filters__chip-btn"
              onClick={selectAllCategories}
              disabled={allCategoriesChecked}
            >
              All
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary website-products-filters__chip-btn"
              onClick={clearAllCategories}
              disabled={checkedCategories.size === 0}
            >
              None
            </button>
          </div>
        </div>
        <ul className="list-unstyled mb-0 website-products-filters__checks">
          {categoryLabels.map((label) => (
            <li key={label}>
              <label className="website-products-filters__check">
                <input
                  type="checkbox"
                  checked={checkedCategories.has(label)}
                  onChange={() => setCheckedCategories((prev) => toggleInSet(prev, label))}
                />
                <span>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="website-products-filters__group mb-4">
        <span className="website-products-filters__label d-block mb-2">Price (INR)</span>
        <div className="row g-2">
          <div className="col-6">
            <label className="form-label small mb-1" htmlFor="filter-price-min">
              Min
            </label>
            <input
              id="filter-price-min"
              type="number"
              className="form-control form-control-sm website-products-filters__input"
              min={0}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
          </div>
          <div className="col-6">
            <label className="form-label small mb-1" htmlFor="filter-price-max">
              Max
            </label>
            <input
              id="filter-price-max"
              type="number"
              className="form-control form-control-sm website-products-filters__input"
              min={0}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="website-products-filters__group mb-0">
        <label className="website-products-filters__label d-block mb-2" htmlFor="filter-sort">
          Sort by
        </label>
        <select
          id="filter-sort"
          className="form-select form-select-sm website-products-filters__select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
    </>
  );
}
