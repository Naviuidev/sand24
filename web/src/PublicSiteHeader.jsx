import { Offcanvas } from "bootstrap";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "./config";
import { useAuth } from "./AuthContext";
import { useShop } from "./ShopContext";

function HeaderIconNavLink({ to, label, badge, children }) {
  const n = Number(badge) || 0;
  return (
    <Link
      to={to}
      className="public-header-icon public-header-icon--badged"
      aria-label={n > 0 ? `${label} (${n})` : label}
      title={label}
    >
      {children}
      {n > 0 ? (
        <span className="public-header-badge" aria-hidden>
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Link>
  );
}

function MobileNavAccordion({ groups }) {
  const audiences = [
    { id: "him", key: "for_him", label: "FOR HIM" },
    { id: "her", key: "for_her", label: "FOR HER" },
    { id: "kids", key: "kids", label: "FOR KIDS" },
  ];
  return (
    <div className="accordion accordion-flush public-mobile-accordion" id="mobileNavAccordion">
      {audiences.map((a) => {
        const items = groups[a.key] || [];
        const collapseId = `mobileCollapse${a.id}`;
        const headingId = `mobileHeading${a.id}`;
        return (
          <div className="accordion-item" key={a.key}>
            <h2 className="accordion-header" id={headingId}>
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#${collapseId}`}
                aria-expanded="false"
                aria-controls={collapseId}
              >
                {a.label}
              </button>
            </h2>
            <div
              id={collapseId}
              className="accordion-collapse collapse"
              aria-labelledby={headingId}
              data-bs-parent="#mobileNavAccordion"
            >
              <div className="accordion-body">
                {items.length === 0 ? (
                  <p className="public-mobile-empty mb-0">No categories yet</p>
                ) : (
                  <ul className="list-unstyled mb-0 public-mobile-subnav">
                    {items.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/products?category=${c.id}`}
                          className="public-mobile-sublink"
                          data-bs-dismiss="offcanvas"
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AudienceNavDropdown({ label, categories: items }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`public-nav-dropdown${open ? " public-nav-dropdown--open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="public-nav-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <svg className="public-nav-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 4.25L6 7.75l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul className="public-dropdown-menu" role="menu">
        {items.length === 0 ? (
          <li className="public-dropdown-empty" role="presentation">
            No categories yet
          </li>
        ) : (
          items.map((c) => (
            <li key={c.id} role="none">
              <Link
                role="menuitem"
                to={`/products?category=${c.id}`}
                className="public-dropdown-link"
                onClick={() => setOpen(false)}
              >
                {c.name}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function AccountDropdownPanel({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return (
      <ul className="public-dropdown-menu public-account-dropdown-menu" role="menu">
        <li role="none">
          <Link role="menuitem" className="public-dropdown-link" to="/profile" onClick={onNavigate}>
            Profile
          </Link>
        </li>
        <li role="none">
          <Link
            role="menuitem"
            className="public-dropdown-link"
            to="/profile?tab=queries"
            onClick={onNavigate}
          >
            Queries
          </Link>
        </li>
        <li role="none">
          <button
            type="button"
            role="menuitem"
            className="public-dropdown-link public-account-dropdown-signout"
            onClick={() => {
              logout();
              onNavigate?.();
              navigate("/");
            }}
          >
            Sign out
          </button>
        </li>
      </ul>
    );
  }

  return (
    <ul className="public-dropdown-menu public-account-dropdown-menu" role="menu">
      <li role="none">
        <Link role="menuitem" className="public-dropdown-link" to="/login" onClick={onNavigate}>
          Sign in
        </Link>
      </li>
      <li role="none">
        <Link role="menuitem" className="public-dropdown-link" to="/register" onClick={onNavigate}>
          Sign up
        </Link>
      </li>
    </ul>
  );
}

export default function PublicSiteHeader() {
  const { user, logout } = useAuth();
  const { cartQuantity, wishlistCount } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const offcanvasRef = useRef(null);
  const mobileAccountRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/categories`);
        if (!cancelled) setCategories(res.data?.data || []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = offcanvasRef.current;
    if (!el) return undefined;
    const onShown = () => setMobileNavOpen(true);
    const onHidden = () => setMobileNavOpen(false);
    el.addEventListener("shown.bs.offcanvas", onShown);
    el.addEventListener("hidden.bs.offcanvas", onHidden);
    return () => {
      el.removeEventListener("shown.bs.offcanvas", onShown);
      el.removeEventListener("hidden.bs.offcanvas", onHidden);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 992px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!mobileAccountRef.current?.contains(e.target)) setMobileAccountOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const q = new URLSearchParams(location.search).get("q");
    setSearchQuery(q || "");
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [searchOpen, location.search]);

  const closeMobileNav = () => {
    const el = offcanvasRef.current ?? document.getElementById("publicNavOffcanvas");
    if (el) Offcanvas.getInstance(el)?.hide();
  };

  const groups = useMemo(() => {
    const g = { for_him: [], for_her: [], kids: [] };
    for (const c of categories) {
      if (g[c.audience]) g[c.audience].push(c);
    }
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => a.name.localeCompare(b.name));
    }
    return g;
  }, [categories]);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email?.split("@")[0]
    : "";

  return (
    <header className="public-site-header">
      <div className="public-header-inner">
        <div className="public-header-top">
          <div className="public-header-leading">
            {!mobileNavOpen ? (
              <button
                className="public-hamburger d-lg-none"
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#publicNavOffcanvas"
                aria-controls="publicNavOffcanvas"
                aria-label="Open menu"
              >
                <span className="public-hamburger-box" aria-hidden="true">
                  <span className="public-hamburger-line" />
                  <span className="public-hamburger-line" />
                  <span className="public-hamburger-line" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="public-nav-open-brand d-lg-none"
                onClick={closeMobileNav}
                aria-label="Close menu"
              >
                sand24
              </button>
            )}
            <Link to="/" className="public-brand text-truncate">
              <img
                src="/sand24-logo-mark.png"
                alt="Sand 24 — Fashion from nature"
                className="public-brand__logo-img"
              />
            </Link>
          </div>
          <div className="public-header-tools">
            <button
              type="button"
              className="public-header-icon"
              aria-label="Search products"
              aria-expanded={searchOpen}
              aria-controls="public-header-search-panel"
              onClick={() => setSearchOpen((o) => !o)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <HeaderIconNavLink to="/wishlist" label="Wishlist" badge={wishlistCount}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 21s-7-4.35-7-9.5a4.5 4.5 0 0 1 8.06-2.75A4.5 4.5 0 0 1 19 11.5C19 16.65 12 21 12 21z"
                  stroke="currentColor"
                  strokeWidth="1.45"
                  strokeLinejoin="round"
                />
              </svg>
            </HeaderIconNavLink>
            <HeaderIconNavLink to="/cart" label="Shopping cart" badge={cartQuantity}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6h15l-1.5 9h-12L4 3H1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="20" r="1.25" fill="currentColor" />
                <circle cx="18" cy="20" r="1.25" fill="currentColor" />
              </svg>
            </HeaderIconNavLink>

            <div className="public-account-wrap d-none d-lg-block" tabIndex={-1}>
              {user ? (
                <span className="public-account-trigger">
                  <span className="public-account-icon-anchor">
                    <span className="public-account-icon" aria-hidden>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M5 20v-1c0-2.5 2-4.5 7-4.5s7 2 7 4.5v1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <div className="public-account-dropdown" aria-label="Account menu">
                      <AccountDropdownPanel onNavigate={() => {}} />
                    </div>
                  </span>
                  <span className="public-account-name" title={displayName}>
                    {displayName}
                  </span>
                </span>
              ) : (
                <span className="public-account-icon-anchor">
                  <button
                    type="button"
                    className="public-account-trigger public-account-icon-btn public-header-icon"
                    aria-label="Account"
                    aria-haspopup="menu"
                  >
                    <span className="public-account-icon" aria-hidden>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                        <path
                          d="M5 20v-1c0-2.5 2-4.5 7-4.5s7 2 7 4.5v1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <div className="public-account-dropdown" aria-label="Account menu">
                    <AccountDropdownPanel onNavigate={() => {}} />
                  </div>
                </span>
              )}
            </div>

            <div className="d-lg-none position-relative" ref={mobileAccountRef}>
              <button
                type="button"
                className="public-header-icon"
                aria-label="Account"
                aria-expanded={mobileAccountOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileAccountOpen((o) => !o);
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M5 20v-1c0-2.5 2-4.5 7-4.5s7 2 7 4.5v1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {mobileAccountOpen && (
                <div className="public-account-dropdown public-account-dropdown--mobile">
                  <AccountDropdownPanel
                    onNavigate={() => {
                      setMobileAccountOpen(false);
                      closeMobileNav();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="public-header-nav d-none d-lg-flex" aria-label="Primary">
          <Link to="/products" className="public-nav-link">
            PRODUCTS
          </Link>
          <AudienceNavDropdown label="FOR HIM" categories={groups.for_him} />
          <AudienceNavDropdown label="FOR HER" categories={groups.for_her} />
          <AudienceNavDropdown label="FOR KIDS" categories={groups.kids} />
          <NavLink
            to="/journal"
            className={({ isActive }) =>
              `public-nav-link${isActive ? " public-nav-link--active" : ""}`
            }
          >
            SAND 24 JOURNAL
          </NavLink>
          <NavLink
            to="/sustainability"
            className={({ isActive }) =>
              `public-nav-link${isActive ? " public-nav-link--active" : ""}`
            }
          >
            SUSTAINABILITY
          </NavLink>
          <NavLink
            to="/story"
            className={({ isActive }) =>
              `public-nav-link${isActive ? " public-nav-link--active" : ""}`
            }
          >
            SAND 24 STORY
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `public-nav-link${isActive ? " public-nav-link--active" : ""}`
            }
          >
            CONTACT
          </NavLink>
        </nav>
      </div>

      <div
        ref={offcanvasRef}
        className="offcanvas offcanvas-start public-nav-offcanvas"
        tabIndex="-1"
        id="publicNavOffcanvas"
        aria-labelledby="publicNavOffcanvasLabel"
        data-bs-scroll="false"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title public-offcanvas-brand-title" id="publicNavOffcanvasLabel">
            sand24
          </h5>
          <button
            type="button"
            className="btn-close public-offcanvas-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close menu"
          />
        </div>
        <div className="offcanvas-body">
          <MobileNavAccordion groups={groups} />
          <nav className="public-mobile-static-nav" aria-label="Site links">
            <Link
              to="/products"
              className="public-mobile-static-link"
              data-bs-dismiss="offcanvas"
            >
              PRODUCTS
            </Link>
            <NavLink
              to="/journal"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              SAND 24 JOURNAL
            </NavLink>
            <NavLink
              to="/sustainability"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              SUSTAINABILITY
            </NavLink>
            <NavLink
              to="/story"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              SAND 24 STORY
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              CONTACT
            </NavLink>
            <Link
              to="/profile?tab=orders"
              className="public-mobile-static-link"
              data-bs-dismiss="offcanvas"
            >
              TRACK ORDER
            </Link>
            <NavLink
              to="/returns-refund"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              RETURNS &amp; REFUND
            </NavLink>
            <NavLink
              to="/terms-and-conditions"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              TERMS &amp; CONDITIONS
            </NavLink>
            <NavLink
              to="/privacy-policy"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              PRIVACY POLICY
            </NavLink>
          </nav>
          <div className="public-mobile-account mt-3 pt-3 border-top">
            {user ? (
              <>
                <div className="public-mobile-account-user-row d-flex align-items-center gap-2 mb-2">
                  <span className="public-mobile-account-icon text-muted" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="M5 20v-1c0-2.5 2-4.5 7-4.5s7 2 7 4.5v1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="public-mobile-account-user small text-muted text-truncate">{displayName}</span>
                </div>
                <Link
                  className="public-mobile-static-link d-block"
                  to="/profile"
                  data-bs-dismiss="offcanvas"
                >
                  Profile
                </Link>
                <Link
                  className="public-mobile-static-link d-block"
                  to="/profile?tab=queries"
                  data-bs-dismiss="offcanvas"
                >
                  Queries
                </Link>
                <button
                  type="button"
                  className="btn btn-link public-mobile-static-link d-block p-0 text-start"
                  data-bs-dismiss="offcanvas"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="public-mobile-static-link d-block" to="/login" data-bs-dismiss="offcanvas">
                  Sign in
                </Link>
                <Link
                  className="public-mobile-static-link d-block"
                  to="/register"
                  data-bs-dismiss="offcanvas"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`public-header-search${searchOpen ? " public-header-search--open" : ""}`}
        aria-hidden={!searchOpen}
      >
        <div
          className="public-header-search__backdrop"
          role="presentation"
          onClick={() => setSearchOpen(false)}
        />
        <div
          id="public-header-search-panel"
          className="public-header-search__sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Search products"
        >
          <form
            className="public-header-search__form"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (q) {
                navigate(`/products?q=${encodeURIComponent(q)}`);
              } else {
                navigate("/products");
              }
              setSearchOpen(false);
            }}
          >
            <div className="public-header-search__head">
              <h2 className="public-header-search__title">Search</h2>
              <button
                type="button"
                className="public-header-search__close"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                ×
              </button>
            </div>
            <label htmlFor="public-header-search-input" className="visually-hidden">
              Search by product name or category
            </label>
            <div className="public-header-search__field-row">
              <input
                id="public-header-search-input"
                ref={searchInputRef}
                type="search"
                name="q"
                autoComplete="off"
                placeholder="Search by title or category…"
                className="public-header-search__input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="public-header-search__submit">
                Go
              </button>
            </div>
            <p className="public-header-search__hint small text-muted mb-0">
              Find products by name, category, or collection.
            </p>
          </form>
        </div>
      </div>
    </header>
  );
}
