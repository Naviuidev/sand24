import { Offcanvas } from "bootstrap";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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

function PublicNavIcon({ children, label, ...rest }) {
  return (
    <button type="button" className="public-header-icon" aria-label={label} {...rest}>
      {children}
    </button>
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
  return (
    <div className="public-nav-dropdown">
      <button type="button" className="public-nav-trigger" aria-haspopup="menu">
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
          Sign Up ( with Social media or Mobile Num )
        </Link>
      </li>
    </ul>
  );
}

export default function PublicSiteHeader() {
  const { user, logout } = useAuth();
  const { cartQuantity, wishlistCount } = useShop();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const offcanvasRef = useRef(null);
  const mobileAccountRef = useRef(null);

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
            <PublicNavIcon label="Search">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </PublicNavIcon>
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
                  <span className="public-account-name" title={displayName}>
                    {displayName}
                  </span>
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
                </span>
              ) : (
                <button type="button" className="public-account-icon-btn public-header-icon" aria-label="Account">
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
              )}
              <div className="public-account-dropdown" aria-label="Account">
                <AccountDropdownPanel onNavigate={() => {}} />
              </div>
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
            <Link
              to="/profile?tab=orders"
              className="public-mobile-static-link"
              data-bs-dismiss="offcanvas"
            >
              TRACK ORDER
            </Link>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `public-mobile-static-link${isActive ? " public-mobile-static-link--active" : ""}`
              }
              data-bs-dismiss="offcanvas"
            >
              CONTACT
            </NavLink>
          </nav>
          <div className="public-mobile-account mt-3 pt-3 border-top">
            {user ? (
              <>
                <p className="public-mobile-account-user mb-2 small text-muted">{displayName}</p>
                <Link
                  className="public-mobile-static-link d-block"
                  to="/profile"
                  data-bs-dismiss="offcanvas"
                >
                  Profile
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
    </header>
  );
}
