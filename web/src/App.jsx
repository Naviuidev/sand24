import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import axios from "axios";
import { useAuth } from "./AuthContext.jsx";
import { useShop } from "./ShopContext.jsx";
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
import ProductsPage from "./ProductsPage.jsx";
import Sand24StoryPage from "./Sand24StoryPage.jsx";
import JournalPage from "./JournalPage.jsx";
import JournalPostPage from "./JournalPostPage.jsx";
import SustainabilityPage from "./SustainabilityPage.jsx";
import ReturnsRefundPage from "./ReturnsRefundPage.jsx";
import PrivacyPolicyPage from "./PrivacyPolicyPage.jsx";
import TermsConditionsPage from "./TermsConditionsPage.jsx";
import ContactPage from "./ContactPage.jsx";
import AdminBlogPage from "./AdminBlogPage.jsx";
import AdminBusinessSidebar from "./AdminBusinessSidebar.jsx";
import ProductDetailPage from "./ProductDetailPage.jsx";
import BuyNowPage from "./BuyNowPage.jsx";
import CheckoutPage from "./CheckoutPage.jsx";
import PaymentResultPage from "./PaymentResultPage.jsx";
import PaymentSuccessPage from "./PaymentSuccessPage.jsx";
import PaymentFailedPage from "./PaymentFailedPage.jsx";
import PaymentPendingPage from "./PaymentPendingPage.jsx";
import CartPage from "./CartPage.jsx";
import WishlistPage from "./WishlistPage.jsx";
import WishlistPanel from "./WishlistPanel.jsx";
import CartPanel from "./CartPanel.jsx";
import ProfileOrdersPanel from "./ProfileOrdersPanel.jsx";
import ProfileQueriesPanel from "./ProfileQueriesPanel.jsx";
import AdminOrderFulfillment from "./AdminOrderFulfillment.jsx";
import AdminSupportQueriesPanel from "./AdminSupportQueriesPanel.jsx";
import AdminContactPanel from "./AdminContactPanel.jsx";
import "./App.css";
import heroImgUrl from "./assets/hero-home.png";

const HERO_IMAGE_URL = heroImgUrl;
const LINEN_COLLECTION_HERO_BG_URL = "/assets/images/linen-collection/hero-fullbleed.png";
const CHANDERI_GIRL_SPOTLIGHT_IMAGE_URL = "/assets/images/chanderi-lehenga-featured.png";
const CHANDERI_BOY_SPOTLIGHT_IMAGE_URL = "/assets/images/chanderi-spotlight-collage.png";
const CHANDERI_SPOTLIGHT_TITLE = "Soft as petals, made for little moments";
const CHANDERI_BOY_SPOTLIGHT_TITLE = "Naturally Dyed Cotton Shirt | Breathable & Pure";

const STUDIO_SUSTAINABILITY_CARDS = [
  {
    key: "green-facility",
    imageSrc: "/assets/images/sustainability/hand-block-printing.png",
    imageWidth: 693,
    imageHeight: 721,
    imageAlt: "Artisan pressing a wooden block to hand-print fabric in the Sand 24 studio",
    body:
      "While plastic and polyester use is negligent in our studio and design process, we are also setting new goals for ourselves as we aim to be a completely green facility by both reducing as well as offsetting our carbon emissions.",
  },
  {
    key: "fabric-usage",
    imageSrc: "/assets/images/sustainability/fabric-workspace.png",
    imageWidth: 693,
    imageHeight: 721,
    imageAlt: "Designer arranging embroidered fabric samples on a frame at Sand 24",
    body:
      "At Sand 24, our design team is trained to incorporate fabrics usage backwards to ensure that most of the yarn and the fabric is used back as new resources with the help of design and technical knowhow.",
  },
];

const HOME_PILLAR_CARDS = [
  {
    key: "prints",
    imageSrc: "/assets/images/pillars/prints.png",
    imageWidth: 464,
    imageHeight: 357,
    imageAlt: "Model in a hand-block printed dress beside a tree",
    title: "Browse Our Newest Prints",
    tagline: "Shop by Green Touch",
    btnLabel: "Shop Prints",
    href: "/sustainability",
  },
  {
    key: "craft",
    imageSrc: "/assets/images/pillars/craft.png",
    imageWidth: 464,
    imageHeight: 357,
    imageAlt: "Hands dipping natural fabric into a warm dye bath",
    title: "Craft & Sustainability",
    tagline: "Clothing That Tells a Story",
    btnLabel: "Our Green Journal",
    href: "/sustainability",
  },
  {
    key: "vision",
    imageSrc: "/assets/images/pillars/vision.png",
    imageWidth: 464,
    imageHeight: 357,
    imageAlt: "Natural dye materials and folded hand-dyed textiles",
    title: "Design that Puts Nature First",
    tagline: "We Craft Slow",
    btnLabel: "Our Sand 24 Vision",
    href: "/sustainability",
  },
];

function parseOptionalPositiveCategoryId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Optional override when auto-detection fails: `VITE_HOME_DRESS_CATEGORY_ID` (numeric id from admin). */
const ENV_HOME_DRESS_CATEGORY_ID = parseOptionalPositiveCategoryId(
  import.meta.env.VITE_HOME_DRESS_CATEGORY_ID
);

function normalizeCategoryText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** Category row name looks like Dress / Dresses (For Her is matched separately). */
function categoryNameImpliesDress(name) {
  const s = normalizeCategoryText(name);
  if (!s) return false;
  if (/\b(dresses?)\b/i.test(s)) return true;
  const compact = s.replace(/\s+/g, "");
  return /^dress(es)?$/i.test(compact);
}

/** For Her → Dress section on home: match real admin category names. */
function findForHerDressCategory(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const candidates = list.filter((c) => {
    const aud = String(c.audience || "").toLowerCase();
    return aud === "for_her" && categoryNameImpliesDress(c.name);
  });
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => (Number(b.productCount) || 0) - (Number(a.productCount) || 0)
  )[0];
}

/** `categoryLabel` from API is like "For Her — Dress" (em dash). */
function categoryLabelImpliesForHerDress(label) {
  const t = normalizeCategoryText(label);
  if (!t) return false;
  const lower = t.toLowerCase();
  if (!lower.includes("for her")) return false;
  if (/\b(dresses?)\b/i.test(t)) return true;
  const segments = t.split(/[—–\-]/).map((s) => s.trim().toLowerCase());
  return segments.some((seg) => seg === "dress" || seg === "dresses" || /\b(dresses?)\b/.test(seg));
}

/**
 * Vote by `categoryId` so we pick the label that most products use (handles odd first rows).
 */
function inferHerDressCategoryIdFromProducts(products) {
  const list = Array.isArray(products) ? products : [];
  const scores = new Map();
  for (const p of list) {
    if (!categoryLabelImpliesForHerDress(p.categoryLabel)) continue;
    const id = parseOptionalPositiveCategoryId(p.categoryId);
    if (id == null) continue;
    scores.set(id, (scores.get(id) || 0) + 1);
  }
  if (scores.size === 0) return null;
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Prefer slot 1; otherwise first uploaded slot (matches “first image” in admin order). */
function mountainMeadowProductImageSrc(p) {
  if (!productHasImages(p)) return PRODUCT_IMAGE_PLACEHOLDER;
  const slot =
    Array.isArray(p.imageSlots) && p.imageSlots.includes(1)
      ? 1
      : productPrimaryImageSlot(p);
  return productImageSrc(p.id, slot);
}

const ADMIN_USER = "Bhanu_Sand24";
const ADMIN_PASSWORD = "Sand24_Bhanu";

function adminApiHeaders() {
  const k = import.meta.env.VITE_ADMIN_API_KEY;
  return k ? { "X-Admin-Key": k } : {};
}

/** Scroll to top on client-side navigation so new pages start at the beginning. */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<WebsiteHome />} />
      <Route path="/products/:productId/buy-now" element={<BuyNowPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/payment/result" element={<PaymentResultPage />} />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route path="/payment/failed" element={<PaymentFailedPage />} />
      <Route path="/payment/pending" element={<PaymentPendingPage />} />
      <Route path="/products/:productId" element={<ProductDetailPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/story" element={<Sand24StoryPage />} />
      <Route path="/journal/:slug" element={<JournalPostPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/sustainability" element={<SustainabilityPage />} />
      <Route path="/returns-refund" element={<ReturnsRefundPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-and-conditions" element={<TermsConditionsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/wishlist" element={<WishlistPage />} />
      <Route path="/login" element={<CustomerLoginPage />} />
      <Route path="/register" element={<CustomerRegisterPage />} />
      <Route path="/forgot-password" element={<CustomerForgotPasswordPage />} />
      <Route path="/profile" element={<CustomerProfilePage />} />
      <Route path="/addresses" element={<CustomerAddressesPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/main-dashboard" element={<AdminMainDashboard />} />
      <Route path="/admin/customize-website" element={<CustomizeWebsitePage />} />
      <Route
        path="/admin/costomise-bussiness"
        element={<CostomiseBussinessPage />}
      />
      <Route path="/admin/blog" element={<AdminBlogPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

function CustomerLoginPage() {
  const { setSession, showBannedModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    location.state?.from && typeof location.state.from === "string" ? location.state.from : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [requiredFieldPopupOpen, setRequiredFieldPopupOpen] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState(null);

  async function onLogin(e) {
    e.preventDefault();
    setErrorPopupMessage(null);
    if (!String(email).trim() || !String(password).trim()) {
      setRequiredFieldPopupOpen(true);
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      setSession(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === "USER_BANNED") {
        showBannedModal();
      } else {
        setErrorPopupMessage(err.response?.data?.message || "Sign in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="website-auth-shell website-auth-shell--footer">
      <PublicSiteHeader />
      <main className="website-auth-page container py-5 flex-grow-1">
        <>
          <h1 className="website-auth-title text-center">Login</h1>
          <p className="website-auth-sub text-center text-muted">Sign in with your email and password</p>
          <form className="website-auth-form mx-auto" onSubmit={onLogin} noValidate>
            <label className="form-label website-auth-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-control website-auth-input mb-3"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label className="form-label website-auth-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-control website-auth-input mb-2"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="text-end mb-3">
              <Link to="/forgot-password" className="btn btn-link btn-sm p-0 website-auth-forgot">
                Forgot Password?
              </Link>
            </div>
            <button type="submit" className="btn website-auth-submit w-100" disabled={busy}>
              {busy ? "Please wait…" : "Sign In"}
            </button>
          </form>
          <p className="text-center mt-4 mb-0 small">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="website-auth-link">
              Sign up
            </Link>
          </p>
        </>
      </main>
      {requiredFieldPopupOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setRequiredFieldPopupOpen(false)}
        >
          <div
            className="website-auth-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="auth-required-popup-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="auth-required-popup-title" className="website-auth-modal__text mb-0">
              Email and password are required.
            </p>
            <button
              type="button"
              className="btn website-auth-modal__btn mt-3"
              onClick={() => setRequiredFieldPopupOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {errorPopupMessage !== null ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setErrorPopupMessage(null)}
        >
          <div
            className="website-auth-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="auth-login-error-popup-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="auth-login-error-popup-title" className="website-auth-modal__text mb-0">
              {errorPopupMessage}
            </p>
            <button
              type="button"
              className="btn website-auth-modal__btn mt-3"
              onClick={() => setErrorPopupMessage(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      <PublicSiteFooter />
    </div>
  );
}

function CustomerRegisterPage() {
  const { setSession, showBannedModal } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [otpMeta, setOtpMeta] = useState({ devConsole: false, serverMessage: "" });
  const [duplicateEmailModalOpen, setDuplicateEmailModalOpen] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("email");
    if (raw == null || String(raw).trim() === "") return;
    try {
      setEmail(decodeURIComponent(String(raw).trim()));
    } catch {
      setEmail(String(raw).trim());
    }
  }, [searchParams]);

  async function onRegister(e) {
    e.preventDefault();
    setError("");
    setDuplicateEmailModalOpen(false);
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        firstName,
        lastName,
        email,
        password,
      });
      setOtpMeta({
        devConsole: Boolean(data?.devOtpInConsole),
        serverMessage: String(data?.message || ""),
      });
      setOtp("");
      setStep("otp");
    } catch (err) {
      const msg = err.response?.data?.message || "";
      const isDuplicate =
        err.response?.status === 409 || /already exists/i.test(String(msg));
      if (isDuplicate) {
        setDuplicateEmailModalOpen(true);
        setError("");
      } else {
        setError(msg || "Could not register.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
        email,
        otp,
        purpose: "register",
      });
      setSession(data.token, data.user);
      navigate("/");
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === "USER_BANNED") {
        showBannedModal();
      } else {
        setError(err.response?.data?.message || "Invalid code.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="website-auth-shell website-auth-shell--footer">
      <PublicSiteHeader />
      <main className="website-auth-page container py-5 flex-grow-1">
        {step === "form" ? (
          <>
            <h1 className="website-auth-title text-center">Register</h1>
            <p className="website-auth-sub text-center text-muted">Please fill in the information below</p>
            <form className="website-auth-form mx-auto" onSubmit={onRegister} noValidate>
              {error && !duplicateEmailModalOpen ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="form-label website-auth-label" htmlFor="reg-fn">
                First Name
              </label>
              <input
                id="reg-fn"
                className="form-control website-auth-input mb-3"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <label className="form-label website-auth-label" htmlFor="reg-ln">
                Last Name
              </label>
              <input
                id="reg-ln"
                className="form-control website-auth-input mb-3"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              <label className="form-label website-auth-label" htmlFor="reg-email">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                className="form-control website-auth-input mb-3"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <label className="form-label website-auth-label" htmlFor="reg-pw">
                Password
              </label>
              <input
                id="reg-pw"
                type="password"
                className="form-control website-auth-input mb-4"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button type="submit" className="btn website-auth-submit w-100" disabled={busy}>
                {busy ? "Please wait…" : "Register"}
              </button>
            </form>
            <p className="text-center mt-4 mb-0 small">
              Already have an account?{" "}
              <Link to="/login" className="website-auth-link">
                Sign In
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="website-auth-title text-center">Verify your email</h1>
            {otpMeta.devConsole ? (
              <p className="website-auth-sub text-center small text-muted">{otpMeta.serverMessage}</p>
            ) : (
              <p className="website-auth-sub text-center text-muted">
                Enter the 6-digit code we emailed to <strong>{email}</strong> (check spam if needed).
              </p>
            )}
            <form className="website-auth-form mx-auto" onSubmit={onVerify}>
              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="form-label website-auth-label" htmlFor="reg-otp">
                One-time password
              </label>
              <input
                id="reg-otp"
                type="text"
                inputMode="numeric"
                className="form-control website-auth-input mb-3 website-auth-otp"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                required
              />
              <button type="submit" className="btn website-auth-submit w-100" disabled={busy || otp.length !== 6}>
                {busy ? "Please wait…" : "Submit"}
              </button>
              <button
                type="button"
                className="btn btn-link w-100 mt-2"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setError("");
                  setOtpMeta({ devConsole: false, serverMessage: "" });
                }}
              >
                Back
              </button>
            </form>
          </>
        )}
      </main>
      {duplicateEmailModalOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => setDuplicateEmailModalOpen(false)}
        >
          <div
            className="website-auth-modal website-auth-modal--with-brand"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="register-dup-email-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="website-auth-modal__head">
              <img
                src="/sand24-logo-mark.png"
                alt="Sand 24"
                className="website-auth-modal__logo"
                width={140}
                height={56}
                decoding="async"
              />
              <button
                type="button"
                className="website-auth-modal__close"
                aria-label="Close"
                onClick={() => setDuplicateEmailModalOpen(false)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="website-auth-modal__body">
              <p id="register-dup-email-title" className="website-auth-modal__text mb-0">
                An account with this email already exists.
              </p>
              <button
                type="button"
                className="btn website-auth-modal__btn mt-3"
                onClick={() => setDuplicateEmailModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PublicSiteFooter />
    </div>
  );
}

function CustomerForgotPasswordPage() {
  const { setSession, showBannedModal } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [otpMeta, setOtpMeta] = useState({ devConsole: false, serverMessage: "" });
  const [resetSuccessModalOpen, setResetSuccessModalOpen] = useState(false);

  async function onRequestOtp(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      setOtpMeta({
        devConsole: Boolean(data?.devOtpInConsole),
        serverMessage: String(data?.message || ""),
      });
      setOtp("");
      setStep("otp");
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === "USER_BANNED") {
        showBannedModal();
      } else {
        setError(err.response?.data?.message || "Could not send code.");
      }
    } finally {
      setBusy(false);
    }
  }

  function onOtpContinue(e) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setStep("password");
  }

  async function onResetPassword(e) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email,
        otp,
        newPassword,
        confirmPassword,
      });
      setSession(data.token, data.user);
      setResetSuccessModalOpen(true);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.code === "USER_BANNED") {
        showBannedModal();
      } else {
        setError(err.response?.data?.message || "Could not reset password.");
      }
    } finally {
      setBusy(false);
    }
  }

  function closeResetSuccessAndHome() {
    setResetSuccessModalOpen(false);
    navigate("/");
  }

  return (
    <div className="website-auth-shell website-auth-shell--footer">
      <PublicSiteHeader />
      <main className="website-auth-page container py-5 flex-grow-1">
        {step === "email" ? (
          <>
            <h1 className="website-auth-title text-center">Forgot password</h1>
            <p className="website-auth-sub text-center text-muted">
              Enter your email and we&apos;ll send a one-time code you can use to reset your password.
            </p>
            <form className="website-auth-form mx-auto" onSubmit={onRequestOtp} noValidate>
              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="form-label website-auth-label" htmlFor="fp-email">
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                className="form-control website-auth-input mb-4"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <button type="submit" className="btn website-auth-submit w-100" disabled={busy}>
                {busy ? "Please wait…" : "Send code"}
              </button>
            </form>
            <p className="text-center mt-4 mb-0 small">
              <Link to="/login" className="website-auth-link">
                Back to login
              </Link>
            </p>
          </>
        ) : step === "otp" ? (
          <>
            <h1 className="website-auth-title text-center">Reset your password</h1>
            {otpMeta.devConsole ? (
              <p className="website-auth-sub text-center small text-muted">{otpMeta.serverMessage}</p>
            ) : (
              <p className="website-auth-sub text-center text-muted">
                Use the one-time code we emailed to <strong>{email}</strong> (check spam if needed).
              </p>
            )}
            <form className="website-auth-form mx-auto" onSubmit={onOtpContinue}>
              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="form-label website-auth-label" htmlFor="fp-otp">
                One-time code
              </label>
              <input
                id="fp-otp"
                type="text"
                inputMode="numeric"
                className="form-control website-auth-input mb-3 website-auth-otp"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
              />
              <button type="submit" className="btn website-auth-submit w-100" disabled={otp.length !== 6}>
                Continue
              </button>
              <button
                type="button"
                className="btn btn-link w-100 mt-2"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError("");
                  setOtpMeta({ devConsole: false, serverMessage: "" });
                }}
              >
                Back
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="website-auth-title text-center">New password</h1>
            <p className="website-auth-sub text-center text-muted">Choose a new password for your account.</p>
            <form className="website-auth-form mx-auto" onSubmit={onResetPassword} noValidate>
              {error ? (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="form-label website-auth-label" htmlFor="fp-np">
                New password
              </label>
              <input
                id="fp-np"
                type="password"
                className="form-control website-auth-input mb-3"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
              <label className="form-label website-auth-label" htmlFor="fp-cp">
                Confirm password
              </label>
              <input
                id="fp-cp"
                type="password"
                className="form-control website-auth-input mb-4"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
              <button type="submit" className="btn website-auth-submit w-100" disabled={busy}>
                {busy ? "Please wait…" : "Update password & sign in"}
              </button>
              <button
                type="button"
                className="btn btn-link w-100 mt-2"
                onClick={() => {
                  setStep("otp");
                  setNewPassword("");
                  setConfirmPassword("");
                  setError("");
                }}
              >
                Back
              </button>
            </form>
          </>
        )}
      </main>
      {resetSuccessModalOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={closeResetSuccessAndHome}
        >
          <div
            className="website-auth-modal website-auth-modal--with-brand website-auth-modal--success"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-success-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="website-auth-modal__head">
              <img
                src="/sand24-logo-mark.png"
                alt="Sand 24"
                className="website-auth-modal__logo"
                width={140}
                height={56}
                decoding="async"
              />
              <button
                type="button"
                className="website-auth-modal__close"
                aria-label="Close"
                onClick={closeResetSuccessAndHome}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="website-auth-modal__body">
              <h2 id="reset-success-title" className="website-auth-modal__title mb-2">
                Password updated
              </h2>
              <p className="website-auth-modal__sub mb-0">
                Your password was reset successfully. You&apos;re signed in — welcome back to Sand 24.
              </p>
              <button type="button" className="btn website-auth-modal__btn mt-3" onClick={closeResetSuccessAndHome}>
                Go to home
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PublicSiteFooter />
    </div>
  );
}

function CustomerProfilePage() {
  const { user, loading, token, logout } = useAuth();
  const { cartQuantity, wishlistCount, refresh } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo(() => {
    const t = searchParams.get("tab");
    const allowed = new Set(["wishlist", "cart", "orders", "queries", "profile"]);
    if (t && allowed.has(t)) return t;
    return "orders";
  }, [searchParams]);

  const incomingPaymentBanner = useMemo(() => {
    const st = location.state;
    if (!st?.paymentSuccess) return null;
    return { orderId: st.orderId, merchantOrderId: st.merchantOrderId };
  }, [location.state]);

  const [stickyPaymentBanner, setStickyPaymentBanner] = useState(null);
  if (incomingPaymentBanner) {
    const next = incomingPaymentBanner;
    const prev = stickyPaymentBanner;
    if (
      !prev ||
      prev.orderId !== next.orderId ||
      prev.merchantOrderId !== next.merchantOrderId
    ) {
      setStickyPaymentBanner(next);
    }
  }

  const [dismissedBannerKey, setDismissedBannerKey] = useState("");
  const bannerKey =
    stickyPaymentBanner?.merchantOrderId != null && stickyPaymentBanner.merchantOrderId !== ""
      ? String(stickyPaymentBanner.merchantOrderId)
      : stickyPaymentBanner?.orderId != null
        ? `id:${stickyPaymentBanner.orderId}`
        : "";
  const showOrderSuccessBanner =
    Boolean(stickyPaymentBanner) && bannerKey !== "" && dismissedBannerKey !== bannerKey;

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const st = location.state;
    if (!st || (!st.paymentSuccess && !st.tab)) return;
    const nextTab = st.paymentSuccess ? "orders" : st.tab;
    if (!["wishlist", "cart", "orders", "queries", "profile"].includes(nextTab)) return;
    navigate({ pathname: "/profile", search: `?tab=${encodeURIComponent(nextTab)}` }, { replace: true, state: {} });
  }, [location.state, navigate]);

  if (!loading && !token) {
    return <Navigate to="/login" replace />;
  }

  function handleLogoutClick() {
    logout();
    navigate("/");
  }

  function goTab(next) {
    setSearchParams({ tab: next }, { replace: true });
  }

  const panelWide = tab === "wishlist" || tab === "cart" || tab === "orders" || tab === "queries";

  return (
    <div className="website-auth-shell website-auth-shell--footer">
      <PublicSiteHeader />
      <main className="website-auth-page container py-4 py-md-5 flex-grow-1 customer-profile-main">
        <h1 className="website-auth-title text-center mb-3 mb-md-4">My account</h1>

        <nav className="customer-profile-tabs" aria-label="Account sections">
          <button
            type="button"
            className={`customer-profile-tab ${tab === "wishlist" ? "active" : ""}`}
            onClick={() => goTab("wishlist")}
          >
            Wishlist
            {wishlistCount > 0 ? (
              <span className="customer-profile-tab__pill" aria-hidden>
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`customer-profile-tab ${tab === "cart" ? "active" : ""}`}
            onClick={() => goTab("cart")}
          >
            Cart
            {cartQuantity > 0 ? (
              <span className="customer-profile-tab__pill" aria-hidden>
                {cartQuantity > 99 ? "99+" : cartQuantity}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`customer-profile-tab ${tab === "orders" ? "active" : ""}`}
            onClick={() => goTab("orders")}
          >
            Orders
          </button>
          <button
            type="button"
            className={`customer-profile-tab ${tab === "queries" ? "active" : ""}`}
            onClick={() => goTab("queries")}
          >
            Raised queries
          </button>
          <button
            type="button"
            className={`customer-profile-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => goTab("profile")}
          >
            Profile
          </button>
          <button type="button" className="customer-profile-tab customer-profile-tab--logout" onClick={handleLogoutClick}>
            Logout
          </button>
        </nav>

        <div className={`customer-profile-panel mx-auto ${panelWide ? "customer-profile-panel--wide" : ""}`}>
          {loading || !user ? (
            <p className="text-center text-muted mb-0">Loading…</p>
          ) : (
            <>
              {tab === "wishlist" && <WishlistPanel variant="profile" />}
              {tab === "cart" && <CartPanel variant="profile" />}
              {tab === "orders" && (
                <>
                  {showOrderSuccessBanner ? (
                    <div className="customer-profile-order-success mb-4 text-center" role="status">
                      <p className="mb-1 customer-profile-order-success__title">Order confirmed</p>
                      <p className="small text-muted mb-2">
                        Thank you for your payment. Your order has been recorded.
                      </p>
                      {stickyPaymentBanner?.orderId != null ? (
                        <p className="small text-muted mb-0">
                          Reference: <strong>#{stickyPaymentBanner.orderId}</strong>
                          {stickyPaymentBanner.merchantOrderId ? (
                            <>
                              {" "}
                              ·{" "}
                              <span className="text-break d-inline-block">
                                {stickyPaymentBanner.merchantOrderId}
                              </span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-sm btn-link customer-profile-order-success__dismiss mt-2 p-0"
                        onClick={() => setDismissedBannerKey(bannerKey)}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                  <ProfileOrdersPanel />
                </>
              )}
              {tab === "queries" && <ProfileQueriesPanel />}
              {tab === "profile" && (
                <div className="customer-profile-details">
                  <h2 className="customer-profile-section__title mb-3">Profile</h2>
                  <p className="mb-2">
                    <strong>Name:</strong> {user.firstName} {user.lastName}
                  </p>
                  <p className="mb-0">
                    <strong>Email:</strong> {user.email}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}

function CustomerAddressesPage() {
  return (
    <div className="website-auth-shell website-auth-shell--footer">
      <PublicSiteHeader />
      <main className="website-auth-page container py-5 flex-grow-1">
        <h1 className="website-auth-title text-center">Addresses</h1>
        <p className="text-center text-muted mb-0">Saved addresses will appear here in a future update.</p>
      </main>
      <PublicSiteFooter />
    </div>
  );
}

/** Public storefront home (`/`). Admin remains under `/admin/*`. */
function WebsiteHome() {
  const [homeProducts, setHomeProducts] = useState([]);
  /** Latest four products in For Her → Dress (by `created_at` from API). */
  const [herDressShowcase, setHerDressShowcase] = useState([]);
  const [herDressCategoryId, setHerDressCategoryId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catSettled, prodSettled] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/categories`),
          axios.get(`${API_BASE_URL}/api/products`),
        ]);
        if (cancelled) return;

        const categories =
          catSettled.status === "fulfilled" ? catSettled.value.data?.data || [] : [];
        const allProducts =
          prodSettled.status === "fulfilled" ? prodSettled.value.data?.data || [] : [];

        setHomeProducts(allProducts);

        let dressCategoryId =
          ENV_HOME_DRESS_CATEGORY_ID ?? findForHerDressCategory(categories)?.id ?? null;
        if (dressCategoryId == null) {
          dressCategoryId = inferHerDressCategoryIdFromProducts(allProducts);
        }

        if (dressCategoryId == null) {
          setHerDressShowcase([]);
          setHerDressCategoryId(null);
          return;
        }

        setHerDressCategoryId(dressCategoryId);
        const cid = Number(dressCategoryId);
        const dressProducts = allProducts
          .filter((p) => Number(p.categoryId) === cid)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 4);
        setHerDressShowcase(dressProducts);
      } catch {
        if (!cancelled) {
          setHomeProducts([]);
          setHerDressShowcase([]);
          setHerDressCategoryId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="website-home-page website-home-page--home">
      <PublicSiteHeader />

      <section className="website-hero-strip py-5" aria-label="Featured">
        <div className="container">
          <div className="website-hero-banner">
            <Link to="/products" className="website-hero-banner-link">
              <img
                src={HERO_IMAGE_URL}
                alt="Sand24 — New Fashion and Summer Idylls. Comfort, style, quality."
                className="website-hero-fullwidth"
                decoding="async"
                fetchPriority="high"
              />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="website-home-section website-intro-cta py-5"
        aria-labelledby="intro-cta-heading"
      >
        <div className="website-intro-cta__inner ">
          <h2 id="intro-cta-heading" className="website-intro-cta__headline">
          Organic clothing where comfort<br/>meets quiet luxury

          </h2>
          <p className="website-intro-cta__tagline">Designed for every day comfort using organic fabrics and natural dyes.</p>
          <Link to="/products" className="website-intro-cta__btn">
            Explore the Collection
            <span className="website-intro-cta__btn-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>
      </section>

      <section
        className="website-home-section website-home-products py-5"
        aria-labelledby="home-products-heading"
      >
        <h2 id="home-products-heading" className="visually-hidden">
          Featured products
        </h2>
        <div className="container-fluid  website-home-products__wrap px-3 px-lg-4">
          {homeProducts.length === 0 ? (
            <p className="website-home-products__empty text-center mb-0">
              No products to show yet.
            </p>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-4 g-lg-4 website-home-products__grid">
              {homeProducts.map((p) => (
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
                    <h3 className="website-product-card__title">
                      <Link to={`/products/${p.id}`} className="website-product-card__title-link">
                        {p.title}
                      </Link>
                    </h3>
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
      </section>
      <section
        id="story"
        className="website-home-section website-planet-section py-5"
        aria-labelledby="consider-clothing-heading"
      >
        <div className="container ">
          <div className="row justify-content-center">
            <div className="col-12 col-md-10 text-center website-planet-head">
              <h2 id="consider-clothing-heading" className="configText mb-0">
                A considered approach of
                <br />
                how our clothing is made
              </h2>
            </div>
          </div>
          <div className="row justify-content-center align-items-start g-4 g-lg-5">
            <div className="col-12 col-md-4">
              <div className="text-center website-planet-col">
                <div className="website-planet-section__figure">
                  <img
                    src="/assets/home-planet/transparency.png"
                    alt="Transparency — illustrated seashells and Sand 24 motif"
                    className="img-fluid website-planet-section__card-img"
                    width={208}
                    height={215}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h5 className="text-dark iconText">Transparency</h5>
                <p className="paraText">
                Every Sand24 garment is transparent from fibre to finish - from making the fabric to the final garment.

                </p>
                
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="text-center website-planet-col">
                <div className="website-planet-section__figure">
                  <img
                    src="/assets/home-planet/zero-plastic.png"
                    alt="Zero plastic — paper bag with recycling symbol and leaves"
                    className="img-fluid website-planet-section__card-img"
                    width={191}
                    height={193}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h5 className="text-dark iconText">Zero Plastic</h5>
                <p className="paraText">
                From packaging to labels, we minimise plastic use by choosing paper-based and compostable alternatives.
                </p>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="text-center website-planet-col">
                <div className="website-planet-section__figure">
                  <img
                    src="/assets/home-planet/smart-qr-labels.png"
                    alt="Material integrity — smart label with QR code"
                    className="img-fluid website-planet-section__card-img"
                    width={185}
                    height={225}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h5 className="text-dark iconText">Material Integrity</h5>
                <p className="paraText">
                Focused on organic fabrics and natural dyes, chosen for comfort, durability, and feel.

                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {homeProducts[0] ? (
        <section
          className="website-home-section website-featured-product py-5"
          aria-labelledby="featured-product-heading"
        >
          <div className="container ">
            <div className="row align-items-center gy-4 website-featured-product__row">
              <div className="col-12 col-md-8 col-lg-8 website-featured-product__visual-col">
                <div className="website-featured-product__visual my-2">
                  <Link
                    to={`/products/${homeProducts[0].id}`}
                    className="website-featured-product__gallery"
                    aria-label={`${homeProducts[0].title} — view product`}
                  >
                    {(() => {
                      const fp = homeProducts[0];
                      const slots = Array.isArray(fp.imageSlots) ? fp.imageSlots : [];
                      const s0 = slots[0];
                      const s1 = slots[1];
                      const s2 = slots[2];
                      return (
                        <>
                          <div className="website-featured-product__gallery-cell website-featured-product__gallery-cell--main">
                            <img
                              src={
                                s0
                                  ? productImageSrc(fp.id, s0)
                                  : PRODUCT_IMAGE_PLACEHOLDER
                              }
                              alt={fp.title}
                              className="website-featured-product__gallery-img"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                              }}
                            />
                          </div>
                          <div className="website-featured-product__gallery-cell website-featured-product__gallery-cell--top">
                            {s1 ? (
                              <img
                                src={productImageSrc(fp.id, s1)}
                                alt=""
                                className="website-featured-product__gallery-img"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : null}
                          </div>
                          <div className="website-featured-product__gallery-cell website-featured-product__gallery-cell--bottom">
                            {s2 ? (
                              <img
                                src={productImageSrc(fp.id, s2)}
                                alt=""
                                className="website-featured-product__gallery-img"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : null}
                          </div>
                        </>
                      );
                    })()}
                  </Link>
                </div>
              </div>
              <div className="col-12 col-md-4 col-lg-4 website-featured-product__copy">
                <div className="my-2">
                  <h2 id="featured-product-heading" className="website-featured-product__title">
                    {homeProducts[0].title}
                  </h2>
                  <p className="website-featured-product__tagline">
                    Better for you
                    <br />
                    Better for planet
                  </p>
                  <div className="website-featured-product__price-row">
                    {homeProducts[0].offerPercent > 0 &&
                    homeProducts[0].originalPrice > 0 &&
                    homeProducts[0].originalPrice > homeProducts[0].finalPrice ? (
                      <>
                        <span className="website-featured-product__price website-featured-product__price--was">
                          {formatRupeeInr(homeProducts[0].originalPrice)}
                        </span>
                        <span className="website-featured-product__price">
                          {formatRupeeInr(homeProducts[0].finalPrice)}
                        </span>
                      </>
                    ) : (
                      <span className="website-featured-product__price">
                        {formatRupeeInr(homeProducts[0].finalPrice)}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/products/${homeProducts[0].id}`}
                    className="website-featured-product__btn"
                  >
                    View More
                    <span className="website-featured-product__btn-arrow" aria-hidden>
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <section
        className="website-home-section website-mountain-meadow py-5"
        aria-labelledby="mountain-meadow-heading"
      >
        <div className="container website-mountain-meadow__inner ">
          <h2 id="mountain-meadow-heading" className="website-mountain-meadow__title">
          "A story of earth, in every thread"<br/>"Soft on you. Gentle on the earth."
          </h2>
          <p className="website-mountain-meadow__tagline">Better for you Better for planet</p>
          {herDressShowcase.length > 0 ? (
            <ul className="website-mountain-meadow__grid list-unstyled mb-0">
              {herDressShowcase.map((p) => (
                <li key={p.id} className="website-mountain-meadow__cell">
                  <Link to={`/products/${p.id}`} className="website-mountain-meadow__card">
                    <span className="website-mountain-meadow__frame">
                      <img
                        src={mountainMeadowProductImageSrc(p)}
                        alt={p.title}
                        className="website-mountain-meadow__img"
                        width={263}
                        height={382}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = PRODUCT_IMAGE_PLACEHOLDER;
                        }}
                      />
                    </span>
                    <span className="website-mountain-meadow__label">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="website-mountain-meadow__empty mb-0">
              {herDressCategoryId != null
                ? "Dress styles will appear here soon."
                : "Browse all products to explore our collections."}
            </p>
          )}
          <div className="website-mountain-meadow__cta">
            <Link
              to={
                herDressCategoryId != null
                  ? `/products?category=${herDressCategoryId}`
                  : "/products"
              }
              className="website-intro-cta__btn"
            >
              View More
              <span className="website-intro-cta__btn-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </div>
      </section>
      <section
        className="website-home-section website-featured-product py-5 website-featured-product--chanderi website-featured-product--chanderi-girl"
        aria-labelledby="chanderi-girl-spotlight-heading"
      >
        <div className="container position-relative ">
          <div className="row align-items-center gx-3 gx-lg-4 gy-4">
            <div className="col-12 col-md-5 col-lg-5 website-featured-product__copy website-featured-product--chanderi__copy">
              <div className="my-2">
                <h2 id="chanderi-girl-spotlight-heading" className="website-featured-product__title">
                  {CHANDERI_SPOTLIGHT_TITLE}
                </h2>
                <p className="website-featured-product__tagline">
                  Better for you
                  <br />
                  Better for planet
                </p>
                <Link to="/products" className="website-featured-product__btn">
                  View More
                  <span className="website-featured-product__btn-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </div>
            <div className="col-12 col-md-7 col-lg-7 website-featured-product__visual-col website-featured-product--chanderi__visual">
              <div className="website-featured-product__visual my-2">
                <img
                  src={CHANDERI_GIRL_SPOTLIGHT_IMAGE_URL}
                  alt={CHANDERI_SPOTLIGHT_TITLE}
                  className="img-fluid w-100 website-featured-product__collage website-featured-product--chanderi__collage"
                  width={774}
                  height={707}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
     
      <section
        id="sustainability"
        className="website-home-section py-5 website-studio-sustain"
        aria-labelledby="sustainability-heading"
      >
        <h2 id="sustainability-heading" className="visually-hidden">
          Sustainability at Sand 24
        </h2>
        <div className="container position-relative website-studio-sustain__inner">
          <div className="row justify-content-center g-4 g-lg-5 website-studio-sustain__row">
            {STUDIO_SUSTAINABILITY_CARDS.map((card) => (
              <div key={card.key} className="col-12 col-lg-6">
                <article className="website-studio-sustain__card h-100">
                  <div className="website-studio-sustain__media">
                    <img
                      src={card.imageSrc}
                      alt={card.imageAlt}
                      className="website-studio-sustain__img img-fluid"
                      width={card.imageWidth}
                      height={card.imageHeight}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <p className="website-studio-sustain__text">{card.body}</p>
                  <div className="website-studio-sustain__cta">
                    <Link to="/story" className="website-intro-cta__btn">
                      View More
                      <span className="website-intro-cta__btn-arrow" aria-hidden>
                        →
                      </span>
                    </Link>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        className="website-home-section py-5 website-featured-product website-featured-product--chanderi website-featured-product--chanderi-boy"
        aria-labelledby="chanderi-boy-spotlight-heading"
      >
        <div className="container position-relative ">
          <div className="row align-items-center gx-3 gx-lg-4 gy-4">
            <div className="col-12 col-md-5 col-lg-5 website-featured-product__copy website-featured-product--chanderi__copy">
              <div className="my-2">
                <h2 id="chanderi-boy-spotlight-heading" className="website-featured-product__title">
                  {CHANDERI_BOY_SPOTLIGHT_TITLE}
                </h2>
                <p className="website-featured-product__tagline">
                  Soft on skin
                  <br />
                  Kind to earth
                </p>
                <Link to="/products" className="website-featured-product__btn">
                  View More
                  <span className="website-featured-product__btn-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </div>
            <div className="col-12 col-md-7 col-lg-7 website-featured-product__visual-col website-featured-product--chanderi__visual">
              <div className="website-featured-product__visual my-2">
                <img
                  src={CHANDERI_BOY_SPOTLIGHT_IMAGE_URL}
                  alt={CHANDERI_BOY_SPOTLIGHT_TITLE}
                  className="img-fluid w-100 website-featured-product__collage website-featured-product--chanderi__collage"
                  width={772}
                  height={707}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        id="new-collection"
        className="website-linen-collection-hero"
        aria-labelledby="linen-collection-heading"
      >
        <div
          className="website-linen-collection-hero__bg"
          style={{ backgroundImage: `url(${LINEN_COLLECTION_HERO_BG_URL})` }}
          aria-hidden
        />
        <div className="website-linen-collection-hero__shade" aria-hidden />
        <div className="container-fluid website-linen-collection-hero__inner px-3 px-lg-4 px-xl-5">
          <div className="website-linen-collection-hero__copy">
            <h2 id="linen-collection-heading" className="website-linen-collection-hero__title">
            “Naturally dyed in indigo and turmeric—pure, breathable, and thoughtfully crafted for everyday elegance.”
             
            </h2>
            <p className="website-linen-collection-hero__tagline">
              From Nature&apos;s Peel to sand24&apos;s Perfection.
            </p>
            <Link to="/products" className="website-linen-collection-hero__btn">
              View More
              <span className="website-linen-collection-hero__btn-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </div>
      </section>
      <section
        className="website-home-section website-pillar-trio website-home-page__pre-footer-band py-5"
        aria-labelledby="pillar-trio-heading"
      >
        <h2 id="pillar-trio-heading" className="visually-hidden">
          Explore prints, craft, and our vision
        </h2>
        <div className="container website-pillar-trio__inner ">
          <div className="row g-4 g-lg-5 justify-content-center website-pillar-trio__row">
            {HOME_PILLAR_CARDS.map((card) => (
              <div key={card.key} className="col-12 col-md-6 col-lg-4">
                <article
                  className="website-pillar-trio__card h-100"
                  id={card.key === "craft" ? "journal" : undefined}
                >
                  <div className="website-pillar-trio__media">
                    <img
                      src={card.imageSrc}
                      alt={card.imageAlt}
                      className="website-pillar-trio__img img-fluid"
                      width={card.imageWidth}
                      height={card.imageHeight}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3 className="website-pillar-trio__title">{card.title}</h3>
                  <p className="website-pillar-trio__tagline">{card.tagline}</p>
                  {card.href.startsWith("/") ? (
                    <Link
                      to={card.href}
                      className="website-intro-cta__btn website-pillar-trio__btn"
                    >
                      {card.btnLabel}
                      <span className="website-intro-cta__btn-arrow" aria-hidden>
                        →
                      </span>
                    </Link>
                  ) : (
                    <a href={card.href} className="website-intro-cta__btn website-pillar-trio__btn">
                      {card.btnLabel}
                      <span className="website-intro-cta__btn-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  )}
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </div>
  );
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      formData.username === ADMIN_USER &&
      formData.password === ADMIN_PASSWORD
    ) {
      setMessage("Login successful. Welcome to Sand24 admin portal.");
      navigate("/admin/main-dashboard");
      return;
    }

    setMessage("Invalid admin username or password.");
  };

  return (
    <main className="admin-login-page">
      <div className="container">
        <div className="row admin-login-wrapper g-0">
          <section className="col-lg-6 admin-visual-panel">
            <img
              src="/admin-logo.png"
              alt="Sand24 logo"
              className="admin-illustration admin-visual-logo"
            />
          </section>

          <section className="col-lg-6 admin-form-panel">
            <div className="admin-form-card">
             
              <p className="admin-subtitle">Sand24 Fashion Admin</p>
              <h1>Admin Log In</h1>
              <p className="admin-description">
                Log in using your admin credentials to update website content.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">
                    Admin ID
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    className="form-control"
                    placeholder="Enter admin id"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-control"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <button type="submit" className="btn admin-submit-btn w-100">
                  Submit
                </button>
              </form>

              {message && <p className="admin-message">{message}</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AdminMainDashboard() {
  const navigate = useNavigate();

  return (
    <main className="admin-login-page">
      <div className="container">
        <div className="row admin-login-wrapper g-0">
          <section className="col-lg-6 admin-visual-panel">
            <img
              src="/admin-logo.png"
              alt="Sand24 logo"
              className="admin-illustration admin-visual-logo"
            />
          </section>

          <section className="col-lg-6 admin-form-panel">
            <div className="admin-form-card">
              <p className="admin-subtitle">Sand24 Fashion Admin</p>
              <h1>Main Dashboard</h1>
              <p className="admin-description">
                Choose what you want to manage from the admin panel.
              </p>

              <div className="admin-action-group">
                <button
                  type="button"
                  className="btn admin-submit-btn w-100"
                  onClick={() => navigate("/admin/customize-website")}
                >
                  Customize Website
                </button>
                <button
                  type="button"
                  className="btn admin-submit-btn w-100"
                  onClick={() => navigate("/admin/costomise-bussiness")}
                >
                  Customise Bussiness
                </button>
                <button
                  type="button"
                  className="btn admin-submit-btn w-100"
                  onClick={() => navigate("/admin/blog")}
                >
                  Blog (Journal)
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function CustomizeWebsitePage() {
  const tabs = [
    "Home",
    "Sustainability",
    "Sand 24 story",
    "contact us",
    "Over Bg",
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [bgImageFile, setBgImageFile] = useState(null);
  const [bgImagePreview, setBgImagePreview] = useState("");
  const [bgImageRows, setBgImageRows] = useState([]);
  const [isSavingBg, setIsSavingBg] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const homeSections = [
    {
      id: "hero",
      title: "Hero Banner",
      preview: "Top banner with heading, subtitle, CTA button, and featured image blocks.",
    },
    {
      id: "trending",
      title: "Trending Collection",
      preview: "Product strip for latest arrivals with card image, title, and quick action.",
    },
    {
      id: "story",
      title: "Brand Story",
      preview: "Sand24 story section with image collage and short brand message.",
    },
    {
      id: "offers",
      title: "Offers & Highlights",
      preview: "Campaign banners and seasonal offer sections shown on home page.",
    },
    {
      id: "categories",
      title: "Categories",
      preview: "Category tiles for women, men, kids, and accessories display blocks.",
    },
    {
      id: "footer",
      title: "Footer Content",
      preview: "Footer links, social handles, contact details, and brand footer text.",
    },
  ];
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [heroImageFile, setHeroImageFile] = useState(null);
  const [heroImagePreview, setHeroImagePreview] = useState("");
  const [heroImageRows, setHeroImageRows] = useState([]);
  const [isSavingHeroImage, setIsSavingHeroImage] = useState(false);
  const [heroSaveMessage, setHeroSaveMessage] = useState("");
  const [trendingForm, setTrendingForm] = useState({
    heading: "",
    tagLine: "",
    buttonLink: "",
  });
  const [isSavingTrending, setIsSavingTrending] = useState(false);
  const [trendingSaveMessage, setTrendingSaveMessage] = useState("");
  const [trendingRows, setTrendingRows] = useState([]);
  const [storyForm, setStoryForm] = useState({
    heading: "",
    cards: [
      { imageUrl: "", imageName: "", title: "", description: "" },
      { imageUrl: "", imageName: "", title: "", description: "" },
      { imageUrl: "", imageName: "", title: "", description: "" },
    ],
  });
  const [isSavingStory, setIsSavingStory] = useState(false);
  const [storySaveMessage, setStorySaveMessage] = useState("");
  const [storyRows, setStoryRows] = useState([]);

  const handleCustomizeSection = (sectionId) => {
    setEditingSectionId(sectionId);
  };

  const handleTrendingChange = (event) => {
    const { name, value } = event.target;
    setTrendingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStoryHeadingChange = (event) => {
    setStoryForm((prev) => ({ ...prev, heading: event.target.value }));
  };

  const handleStoryCardChange = (index, field, value) => {
    setStoryForm((prev) => ({
      ...prev,
      cards: prev.cards.map((card, idx) =>
        idx === index ? { ...card, [field]: value } : card
      ),
    }));
  };

  const handleStoryCardImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setStoryForm((prev) => ({
        ...prev,
        cards: prev.cards.map((card, idx) =>
          idx === index ? { ...card, imageUrl: dataUrl, imageName: file.name } : card
        ),
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleHeroImageChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setHeroImageFile(null);
      setHeroImagePreview("");
      return;
    }

    setHeroImageFile(selectedFile);
    setHeroImagePreview(URL.createObjectURL(selectedFile));
  };

  const fetchHeroImages = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/home-hero-image`);
      const rows = response.data?.data || [];
      setHeroImageRows(rows);

      const heroMain = rows.find((row) => row.sectionKey === "hero_main");
      if (heroMain?.previewUrl) {
        setHeroImagePreview(
          `${API_BASE_URL}${heroMain.previewUrl}?t=${encodeURIComponent(heroMain.updatedAt)}`
        );
      }
    } catch (error) {
      setHeroSaveMessage(error.response?.data?.message || "Failed to load hero image data.");
    }
  };

  const fetchTrendingContent = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/home-trending-content`);
      const rows = response.data?.data || [];
      setTrendingRows(rows);

      const trendingMain = rows.find((row) => row.sectionKey === "trending_main");
      if (trendingMain) {
        setTrendingForm({
          heading: trendingMain.heading || "",
          tagLine: trendingMain.tagLine || "",
          buttonLink: trendingMain.buttonLink || "",
        });
      }
    } catch (error) {
      setTrendingSaveMessage(
        error.response?.data?.message || "Failed to load trending section data."
      );
    }
  };

  const fetchStoryContent = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/home-story-content`);
      const rows = response.data?.data || [];
      setStoryRows(rows);

      const storyMain = rows.find((row) => row.sectionKey === "story_main");
      if (storyMain) {
        const cards =
          Array.isArray(storyMain.cards) && storyMain.cards.length === 3
            ? storyMain.cards
            : [
                { imageUrl: "", imageName: "", title: "", description: "" },
                { imageUrl: "", imageName: "", title: "", description: "" },
                { imageUrl: "", imageName: "", title: "", description: "" },
              ];
        setStoryForm({
          heading: storyMain.heading || "",
          cards,
        });
      }
    } catch (error) {
      setStorySaveMessage(error.response?.data?.message || "Failed to load story section.");
    }
  };

  const handleSaveHeroImage = async () => {
    if (!heroImageFile) {
      setHeroSaveMessage("Please choose a hero image before saving.");
      return;
    }

    setIsSavingHeroImage(true);
    setHeroSaveMessage("");

    try {
      const formData = new FormData();
      formData.append("sectionKey", "hero_main");
      formData.append("image", heroImageFile);

      await axios.post(`${API_BASE_URL}/api/home-hero-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setHeroSaveMessage("Hero image saved successfully.");
      await fetchHeroImages();
    } catch (error) {
      setHeroSaveMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save hero image."
      );
    } finally {
      setIsSavingHeroImage(false);
    }
  };

  const handleSaveTrending = async () => {
    if (!trendingForm.heading || !trendingForm.tagLine || !trendingForm.buttonLink) {
      setTrendingSaveMessage("Please fill heading, secondary heading and button link.");
      return;
    }

    setIsSavingTrending(true);
    setTrendingSaveMessage("");

    try {
      await axios.post(`${API_BASE_URL}/api/home-trending-content`, {
        sectionKey: "trending_main",
        heading: trendingForm.heading,
        tagLine: trendingForm.tagLine,
        buttonLink: trendingForm.buttonLink,
      });
      setTrendingSaveMessage("Trending section saved successfully.");
      await fetchTrendingContent();
    } catch (error) {
      setTrendingSaveMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save trending section."
      );
    } finally {
      setIsSavingTrending(false);
    }
  };

  const handleSaveStory = async () => {
    const hasEmpty = !storyForm.heading.trim()
      || storyForm.cards.some(
        (card) => !card.imageUrl.trim() || !card.title.trim() || !card.description.trim()
      );

    if (hasEmpty) {
      setStorySaveMessage("Please fill heading and all 3 cards (image, title, description).");
      return;
    }

    setIsSavingStory(true);
    setStorySaveMessage("");
    try {
      await axios.post(`${API_BASE_URL}/api/home-story-content`, {
        sectionKey: "story_main",
        heading: storyForm.heading,
        cards: storyForm.cards,
      });
      setStorySaveMessage("Story section saved successfully.");
      await fetchStoryContent();
    } catch (error) {
      setStorySaveMessage(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save story section."
      );
    } finally {
      setIsSavingStory(false);
    }
  };

  const handleBgImageChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setBgImageFile(null);
      setBgImagePreview("");
      return;
    }

    setBgImageFile(selectedFile);
    setBgImagePreview(URL.createObjectURL(selectedFile));
  };

  const fetchBgImages = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/background-image`);
      setBgImageRows(response.data?.data || []);
    } catch (error) {
      setSaveMessage(
        error.response?.data?.message || "Failed to load saved background image data."
      );
    }
  };

  useEffect(() => {
    fetchBgImages();
    fetchHeroImages();
    fetchTrendingContent();
    fetchStoryContent();
  }, []);

  const handleSaveBgImage = async () => {
    if (!bgImageFile) {
      setSaveMessage("Please choose a background image before saving.");
      return;
    }

    setIsSavingBg(true);
    setSaveMessage("");

    try {
      const formData = new FormData();
      formData.append("pageKey", "global");
      formData.append("image", bgImageFile);

      await axios.post(`${API_BASE_URL}/api/background-image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSaveMessage("Background image saved successfully.");
      await fetchBgImages();
    } catch (error) {
      setSaveMessage(error.response?.data?.message || "Failed to save background image.");
    } finally {
      setIsSavingBg(false);
    }
  };

  const renderMainContent = () => {
    if (activeTab === "Home") {
      return (
        <section className="customize-workspace over-bg-panel">
          <div className="over-bg-head">
            <h2>Home Page Sections</h2>
            <p>
              Configure homepage sections by heading and preview. Use the action
              buttons to edit each section.
            </p>
          </div>

          <div className="row g-3">
            <div className="col-lg-4">
              <div className="home-sections-list">
                {homeSections.map((section, index) => (
                  <article key={section.id} className="home-section-card">
                    <div className="home-section-card-head">
                      <span className="home-section-badge">Section {index + 1}</span>
                      <h3>{section.title}</h3>
                    </div>
                    <p>{section.preview}</p>
                    <div className="home-section-actions">
                      <button
                        type="button"
                        className="btn admin-submit-btn"
                        onClick={() => handleCustomizeSection(section.id)}
                      >
                        Customise
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="col-lg-8">
              <div className="home-preview-column">
                {editingSectionId === "hero" && (
                  <section className="home-editor-panel">
                    <h3 className="mb-2">Hero Banner Customisation</h3>
                    <p className="mb-3">
                      Upload the hero image for the home page and check the preview.
                    </p>

                    <div className="hero-upload-box">
                      <label className="form-label" htmlFor="heroImageInput">
                        Hero Image
                      </label>
                      <input
                        id="heroImageInput"
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleHeroImageChange}
                      />
                      {heroImageFile && (
                        <p className="admin-description mb-0 mt-2">
                          Selected file: {heroImageFile.name}
                        </p>
                      )}
                    </div>

                    <div className="hero-preview-box">
                      <p className="home-preview-label mb-2">Hero Preview</p>
                      <div className="hero-preview-area">
                        {heroImagePreview ? (
                          <img src={heroImagePreview} alt="Hero preview" />
                        ) : (
                          <p className="mb-0">Upload hero image to preview here.</p>
                        )}
                      </div>
                    </div>

                    <div className="home-section-actions">
                      <button
                        type="button"
                        className="btn admin-submit-btn"
                        disabled={!heroImageFile}
                        onClick={handleSaveHeroImage}
                      >
                        {isSavingHeroImage ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn admin-submit-btn home-preview-btn"
                        onClick={() => setEditingSectionId(null)}
                      >
                        Close
                      </button>
                    </div>

                    {heroSaveMessage && <p className="admin-description mb-0">{heroSaveMessage}</p>}

                    <div className="table-responsive mt-3">
                      <table className="table align-middle mb-0">
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">Section</th>
                            <th scope="col">Image Name</th>
                            <th scope="col">Preview</th>
                            <th scope="col">Updated At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {heroImageRows.length ? (
                            heroImageRows.map((row) => (
                              <tr key={row.id}>
                                <td>{row.id}</td>
                                <td>{row.sectionKey}</td>
                                <td>{row.imageName}</td>
                                <td>
                                  <img
                                    src={`${API_BASE_URL}${row.previewUrl}?t=${encodeURIComponent(
                                      row.updatedAt
                                    )}`}
                                    alt={row.imageName}
                                    className="over-bg-thumb"
                                  />
                                </td>
                                <td>{new Date(row.updatedAt).toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5">No hero image saved yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {editingSectionId && editingSectionId !== "hero" && (
                  editingSectionId === "trending" ? (
                    <section className="home-editor-panel">
                      <h3 className="mb-2">Trending Collection Customisation</h3>
                      <p className="mb-3">
                        Update heading, secondary heading, and button link for this section.
                      </p>

                      <div className="mb-3">
                        <label className="form-label">Heading</label>
                        <input
                          type="text"
                          className="form-control"
                          name="heading"
                          placeholder="Enter section heading"
                          value={trendingForm.heading}
                          onChange={handleTrendingChange}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Secondary Heading (Tag)</label>
                        <input
                          type="text"
                          className="form-control"
                          name="tagLine"
                          placeholder="Enter secondary heading"
                          value={trendingForm.tagLine}
                          onChange={handleTrendingChange}
                        />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Button Link</label>
                        <input
                          type="text"
                          className="form-control"
                          name="buttonLink"
                          placeholder="Enter button link"
                          value={trendingForm.buttonLink}
                          onChange={handleTrendingChange}
                        />
                      </div>

                      <div className="home-section-actions">
                        <button
                          type="button"
                          className="btn admin-submit-btn"
                          onClick={handleSaveTrending}
                        >
                          {isSavingTrending ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn admin-submit-btn home-preview-btn"
                          onClick={() => setEditingSectionId(null)}
                        >
                          Close
                        </button>
                      </div>

                      {trendingSaveMessage && (
                        <p className="admin-description mt-2 mb-0">{trendingSaveMessage}</p>
                      )}

                      <section className="section-live-preview mt-3">
                        <p className="home-preview-label mb-2">Live Preview</p>
                        <div className="website-trending-content section-live-preview-box">
                          <h2>{trendingForm.heading || "Trending Collection"}</h2>
                          <p>
                            {trendingForm.tagLine ||
                              "Product strip for latest arrivals with card image, title, and quick action."}
                          </p>
                          <a
                            href={trendingForm.buttonLink || "#"}
                            className="website-trending-btn"
                            onClick={(event) => event.preventDefault()}
                          >
                            Explore the collection
                          </a>
                        </div>
                      </section>

                      <div className="table-responsive mt-3">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col">ID</th>
                              <th scope="col">Section</th>
                              <th scope="col">Heading</th>
                              <th scope="col">Tag</th>
                              <th scope="col">Button Link</th>
                              <th scope="col">Updated At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trendingRows.length ? (
                              trendingRows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.id}</td>
                                  <td>{row.sectionKey}</td>
                                  <td>{row.heading}</td>
                                  <td>{row.tagLine}</td>
                                  <td>{row.buttonLink}</td>
                                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6">No trending content saved yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : editingSectionId === "story" ? (
                    <section className="home-editor-panel">
                      <h3 className="mb-2">Brand Story Customisation</h3>
                      <p className="mb-3">
                        Add heading and 3 cards with image, title, and description.
                      </p>

                      <div className="mb-3">
                        <label className="form-label">Heading</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter heading"
                          value={storyForm.heading}
                          onChange={handleStoryHeadingChange}
                        />
                      </div>

                      <div className="row g-3">
                        {storyForm.cards.map((card, index) => (
                          <div className="col-lg-4" key={`story-form-card-${index}`}>
                            <div className="story-card-editor">
                              <p className="home-preview-label mb-2">Card {index + 1}</p>
                              <div className="mb-2">
                                <input
                                  type="file"
                                  className="form-control"
                                  accept="image/*"
                                  onChange={(event) => handleStoryCardImageChange(index, event)}
                                />
                                {card.imageName && (
                                  <p className="admin-description mb-0 mt-2">{card.imageName}</p>
                                )}
                              </div>
                              <div className="mb-2">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Title"
                                  value={card.title}
                                  onChange={(event) =>
                                    handleStoryCardChange(index, "title", event.target.value)
                                  }
                                />
                              </div>
                              <textarea
                                className="form-control"
                                rows="3"
                                placeholder="Description"
                                value={card.description}
                                onChange={(event) =>
                                  handleStoryCardChange(index, "description", event.target.value)
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="home-section-actions mt-3">
                        <button
                          type="button"
                          className="btn admin-submit-btn"
                          onClick={handleSaveStory}
                        >
                          {isSavingStory ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn admin-submit-btn home-preview-btn"
                          onClick={() => setEditingSectionId(null)}
                        >
                          Close
                        </button>
                      </div>

                      {storySaveMessage && (
                        <p className="admin-description mt-2 mb-0">{storySaveMessage}</p>
                      )}

                      <section className="section-live-preview mt-3">
                        <p className="home-preview-label mb-2">Live Preview</p>
                        <div className="website-story-content section-live-preview-box">
                          <h2>
                            {storyForm.heading ||
                              "A considered approach of how our clothing is made"}
                          </h2>
                          <div className="row g-4">
                            {storyForm.cards.map((card, index) => (
                              <div className="col-lg-4" key={`story-live-${index}`}>
                                <article className="website-story-card">
                                  {card.imageUrl ? (
                                    <img
                                      src={card.imageUrl}
                                      alt={card.title || `Story card ${index + 1}`}
                                      className="website-story-card-image"
                                    />
                                  ) : null}
                                  <h3>{card.title || `Card ${index + 1}`}</h3>
                                  <p>{card.description || "Card description"}</p>
                                </article>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>

                      <div className="table-responsive mt-3">
                        <table className="table align-middle mb-0">
                          <thead>
                            <tr>
                              <th scope="col">ID</th>
                              <th scope="col">Section</th>
                              <th scope="col">Heading</th>
                              <th scope="col">Updated At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storyRows.length ? (
                              storyRows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.id}</td>
                                  <td>{row.sectionKey}</td>
                                  <td>{row.heading}</td>
                                  <td>{new Date(row.updatedAt).toLocaleString()}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="4">No story content saved yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : (
                  <section className="home-preview-panel">
                    <p className="home-preview-label mb-2">Section Setup</p>
                    <h3>
                      {homeSections.find((item) => item.id === editingSectionId)?.title ||
                        "Section"}
                    </h3>
                    <p className="mb-0">
                      This section customisation UI will be developed in the next steps.
                    </p>
                  </section>
                  )
                )}

                {!editingSectionId && (
                  <section className="home-preview-panel home-preview-empty">
                    <p className="mb-0">
                      Select a section on the left and click <strong>Customise</strong>.
                    </p>
                  </section>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (activeTab !== "Over Bg") {
      return (
        <section className="customize-workspace p-4">
          <h2 className="mb-2">{activeTab}</h2>
          <p className="mb-0">UI for this tab will be developed in next steps.</p>
        </section>
      );
    }

    return (
      <section className="customize-workspace over-bg-panel">
        <div className="over-bg-head">
          <h2>Over Bg</h2>
          <p>
            Upload the main background image. This image will be used as the common
            website background for all pages.
          </p>
        </div>

        <div className="row g-3 align-items-stretch">
          <div className="col-lg-3">
            <div className="over-bg-upload-block">
              <label htmlFor="overBgImage" className="form-label">
                Main Background Image
              </label>
              <input
                id="overBgImage"
                type="file"
                className="form-control"
                accept="image/*"
                onChange={handleBgImageChange}
              />
            </div>
          </div>

          <div className="col-lg-9">
            <div className="over-bg-preview-block">
              <p className="over-bg-preview-title">Background Preview</p>
              <div className="over-bg-preview-area">
                {bgImagePreview ? (
                  <img src={bgImagePreview} alt="Website background preview" />
                ) : (
                  <p className="mb-0">Upload an image to preview it here.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="over-bg-footer">
          <button
            type="button"
            className="btn admin-submit-btn over-bg-save-btn"
            onClick={handleSaveBgImage}
            disabled={isSavingBg}
          >
            {isSavingBg ? "Saving..." : "Save"}
          </button>
          {bgImageFile && (
            <p className="admin-description mb-0">Selected file: {bgImageFile.name}</p>
          )}
        </div>

        {saveMessage && <p className="admin-description mb-0">{saveMessage}</p>}

        <section className="over-bg-table-wrap">
          <p className="over-bg-preview-title mb-2">Saved Background Images</p>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Page Key</th>
                  <th scope="col">Image Name</th>
                  <th scope="col">Preview</th>
                  <th scope="col">Updated At</th>
                </tr>
              </thead>
              <tbody>
                {bgImageRows.length ? (
                  bgImageRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.pageKey}</td>
                      <td>{row.imageName}</td>
                      <td>
                        <img
                          src={`${API_BASE_URL}${row.previewUrl}?t=${encodeURIComponent(
                            row.updatedAt
                          )}`}
                          alt={row.imageName}
                          className="over-bg-thumb"
                        />
                      </td>
                      <td>{new Date(row.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">No background image saved yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  };

  return (
    <main className="admin-login-page">
      <div className="container-fluid py-4">
        <section className="customize-dashboard">
          <aside className="customize-sidebar">
            <div>
              <img src="/admin-logo.png" alt="Sand24 logo" className="customize-logo" />
              <p className="admin-subtitle mb-4">Sand24 Admin</p>

              <nav className="customize-nav">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`customize-nav-item ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <section className="customize-main">
            <h1 className="mb-2">{activeTab}</h1>
            <p className="admin-subtitle mb-4">Website Content Management</p>
            {renderMainContent()}
          </section>
        </section>
      </div>
    </main>
  );
}

const AUDIENCE_OPTIONS = [
  { value: "for_him", label: "For Him" },
  { value: "for_her", label: "For Her" },
  { value: "kids", label: "Kids" },
];

const PRODUCT_SIZE_OPTIONS = ["S", "M", "L", "XL"];

function CostomiseBussinessPage() {
  const location = useLocation();
  const stableAdminHeaders = useMemo(() => adminApiHeaders(), []);
  const [businessSection, setBusinessSection] = useState("categories");
  const [categories, setCategories] = useState([]);
  const [listMessage, setListMessage] = useState("");
  const [createStep, setCreateStep] = useState("idle");
  const [newAudience, setNewAudience] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const [productFormKey, setProductFormKey] = useState(0);
  const [productTitle, setProductTitle] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [offerPercent, setOfferPercent] = useState("0");
  const [quantityAvailable, setQuantityAvailable] = useState("");
  const [selectedSizes, setSelectedSizes] = useState(() => new Set());
  const [fabric, setFabric] = useState("");
  const [color, setColor] = useState("");
  const [printStyle, setPrintStyle] = useState("");
  const [bodyFit, setBodyFit] = useState("");
  const [features, setFeatures] = useState("");
  const [neckType, setNeckType] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [shipmentDelivery, setShipmentDelivery] = useState("");
  const [returnExchange, setReturnExchange] = useState("");
  const [imageFiles, setImageFiles] = useState([null, null, null, null]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState([null, null, null, null]);
  /** Server slots 1–4 that already have an image (edit mode). */
  const [editingImageSlots, setEditingImageSlots] = useState([]);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productMessage, setProductMessage] = useState("");
  const [productList, setProductList] = useState([]);
  const [productListMessage, setProductListMessage] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingProductUpdatedAt, setEditingProductUpdatedAt] = useState("");
  const [pendingProductDelete, setPendingProductDelete] = useState(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [usersMessage, setUsersMessage] = useState("");
  const [banBusyId, setBanBusyId] = useState(null);
  const [adminSaveModal, setAdminSaveModal] = useState(null);

  const handleSidebarSection = (section) => {
    setBusinessSection(section);
    if (section === "products") setProductMessage("");
    if (section === "users") setUsersMessage("");
  };

  useEffect(() => {
    const s = location.state?.section;
    if (typeof s === "string" && s.length > 0) {
      setBusinessSection(s);
      if (s === "products") setProductMessage("");
      if (s === "users") setUsersMessage("");
    }
  }, [location.pathname, location.state]);

  const finalPriceDisplay = useMemo(() => {
    const o = parseFloat(originalPrice);
    const p = parseFloat(offerPercent);
    if (!Number.isFinite(o) || o < 0) return "—";
    if (!Number.isFinite(p) || p < 0 || p > 100) return "—";
    return (Math.round(o * (100 - p)) / 100).toFixed(2);
  }, [originalPrice, offerPercent]);

  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((row) => {
      const name = (row.name || "").toLowerCase();
      const audience = (row.audienceLabel || "").toLowerCase();
      const count = String(row.productCount ?? "");
      return name.includes(q) || audience.includes(q) || count.includes(q);
    });
  }, [categories, categorySearchQuery]);

  const filteredProducts = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter((row) => {
      const title = (row.title || "").toLowerCase();
      const cat = (row.categoryLabel || "").toLowerCase();
      const items = String(row.quantityAvailable ?? "");
      const added = new Date(row.createdAt).toLocaleString().toLowerCase();
      return (
        title.includes(q) || cat.includes(q) || items.includes(q) || added.includes(q)
      );
    });
  }, [productList, productSearchQuery]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/categories`);
      setCategories(response.data?.data || []);
      setListMessage("");
    } catch (error) {
      setListMessage(
        error.response?.data?.message || "Failed to load categories."
      );
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products`);
      setProductList(response.data?.data || []);
    } catch (error) {
      const d = error.response?.data;
      const detail = [d?.sqlMessage, d?.error].filter(Boolean).join(" — ");
      setProductListMessage(
        detail || d?.message || "Failed to load products."
      );
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (businessSection === "products") {
      fetchProducts();
    }
  }, [businessSection]);

  const fetchUsers = async () => {
    setUsersMessage("");
    try {
      const response = await axios.get(`${API_BASE_URL}/api/admin/users`, { headers: adminApiHeaders() });
      setUsersList(response.data?.data || []);
    } catch (error) {
      setUsersMessage(error.response?.data?.message || "Failed to load users.");
      setUsersList([]);
    }
  };

  useEffect(() => {
    if (businessSection === "users") {
      fetchUsers();
    }
  }, [businessSection]);

  const toggleUserBan = async (row) => {
    setBanBusyId(row.id);
    setUsersMessage("");
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/users/${row.id}/ban`,
        { banned: !row.banned },
        { headers: adminApiHeaders() }
      );
      await fetchUsers();
      setAdminSaveModal({
        title: "Saved",
        message: "User account status was updated.",
      });
    } catch (error) {
      setUsersMessage(error.response?.data?.message || "Could not update user.");
    } finally {
      setBanBusyId(null);
    }
  };

  useEffect(() => {
    if (!pendingDelete) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isDeletingCategory) {
        setPendingDelete(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDelete, isDeletingCategory]);

  useEffect(() => {
    if (!pendingProductDelete) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isDeletingProduct) {
        setPendingProductDelete(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingProductDelete, isDeletingProduct]);

  useEffect(() => {
    const urls = imageFiles.map((f) => (f ? URL.createObjectURL(f) : null));
    setImagePreviewUrls(urls);
    return () => {
      urls.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [imageFiles]);

  const resetProductForm = () => {
    setProductFormKey((k) => k + 1);
    setEditingProductId(null);
    setProductTitle("");
    setProductCategoryId("");
    setOriginalPrice("");
    setOfferPercent("0");
    setQuantityAvailable("");
    setSelectedSizes(new Set());
    setFabric("");
    setColor("");
    setPrintStyle("");
    setBodyFit("");
    setFeatures("");
    setNeckType("");
    setProductDetails("");
    setShipmentDelivery("");
    setReturnExchange("");
    setImageFiles([null, null, null, null]);
    setEditingImageSlots([]);
    setEditingProductUpdatedAt("");
  };

  const openAddProductForm = () => {
    resetProductForm();
    setProductMessage("");
    setShowProductForm(true);
  };

  const closeProductForm = () => {
    if (productSubmitting) return;
    setShowProductForm(false);
    resetProductForm();
    setProductMessage("");
  };

  const startEditProduct = async (row) => {
    setProductListMessage("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/products/${row.id}`);
      const d = res.data?.data;
      if (!d) return;
      setEditingProductId(d.id);
      setProductTitle(d.title || "");
      setProductCategoryId(String(d.categoryId));
      setOriginalPrice(String(d.originalPrice ?? ""));
      setOfferPercent(String(d.offerPercent ?? "0"));
      setQuantityAvailable(String(d.quantityAvailable ?? ""));
      setSelectedSizes(new Set(Array.isArray(d.sizes) ? d.sizes : []));
      setFabric(d.fabric || "");
      setColor(d.color || "");
      setPrintStyle(d.printStyle || "");
      setBodyFit(d.bodyFit || "");
      setFeatures(d.features || "");
      setNeckType(d.neckType || "");
      setProductDetails(d.productDetails || "");
      setShipmentDelivery(d.shipmentDelivery || "");
      setReturnExchange(d.returnExchange || "");
      setImageFiles([null, null, null, null]);
      setEditingImageSlots(Array.isArray(d.imageSlots) ? d.imageSlots : []);
      setEditingProductUpdatedAt(d.updatedAt != null ? String(d.updatedAt) : "");
      setProductFormKey((k) => k + 1);
      setProductMessage("");
      setShowProductForm(true);
    } catch (error) {
      setProductListMessage(
        error.response?.data?.message || "Failed to load product for editing."
      );
    }
  };

  const openDeleteProductModal = (row) => {
    setPendingProductDelete({ id: row.id, title: row.title });
  };

  const closeDeleteProductModal = () => {
    if (isDeletingProduct) return;
    setPendingProductDelete(null);
  };

  const confirmDeleteProduct = async () => {
    if (!pendingProductDelete) return;
    setIsDeletingProduct(true);
    setProductListMessage("");
    try {
      await axios.delete(`${API_BASE_URL}/api/products/${pendingProductDelete.id}`);
      setPendingProductDelete(null);
      setProductListMessage("");
      setAdminSaveModal({
        title: "Deleted",
        message: "Product deleted.",
      });
      await fetchProducts();
      await fetchCategories();
    } catch (error) {
      setProductListMessage(
        error.response?.data?.message || "Failed to delete product."
      );
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const productImageSlotSrc = (index) => {
    const slotNum = index + 1;
    if (imagePreviewUrls[index]) return imagePreviewUrls[index];
    if (editingProductId && !imageFiles[index]) {
      if (!editingImageSlots.includes(slotNum)) return null;
      const v =
        editingProductUpdatedAt !== ""
          ? `?v=${encodeURIComponent(editingProductUpdatedAt)}`
          : "";
      return `${API_BASE_URL}/api/products/${editingProductId}/images/${slotNum}/preview${v}`;
    }
    return null;
  };

  const toggleProductSize = (size) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  };

  const handleProductImageChange = (index, fileList) => {
    const file = fileList?.[0] || null;
    setImageFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    setProductMessage("");
    const isEdit = Boolean(editingProductId);

    if (selectedSizes.size === 0) {
      setProductMessage("Select at least one size.");
      return;
    }
    if (!productCategoryId) {
      setProductMessage("Select a category.");
      return;
    }
    if (!productTitle.trim()) {
      setProductMessage("Title is required.");
      return;
    }
    setProductSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("categoryId", productCategoryId);
      fd.append("title", productTitle.trim());
      fd.append("originalPrice", String(originalPrice));
      fd.append("offerPercent", offerPercent === "" ? "0" : String(offerPercent));
      fd.append("quantityAvailable", String(quantityAvailable === "" ? "0" : quantityAvailable));
      fd.append("sizes", JSON.stringify(Array.from(selectedSizes)));
      fd.append("fabric", fabric);
      fd.append("color", color);
      fd.append("printStyle", printStyle);
      fd.append("bodyFit", bodyFit);
      fd.append("features", features);
      fd.append("neckType", neckType);
      fd.append("productDetails", productDetails);
      fd.append("shipmentDelivery", shipmentDelivery);
      fd.append("returnExchange", returnExchange);

      if (isEdit) {
        imageFiles.forEach((f, i) => {
          if (f) fd.append(`image${i + 1}`, f);
        });
        await axios.put(`${API_BASE_URL}/api/products/${editingProductId}`, fd);
      } else {
        imageFiles.forEach((f, i) => {
          if (f) fd.append(`image${i + 1}`, f);
        });
        await axios.post(`${API_BASE_URL}/api/products`, fd);
      }

      setShowProductForm(false);
      resetProductForm();
      setProductListMessage("");
      setAdminSaveModal({
        title: "Saved",
        message: isEdit ? "Product updated successfully." : "Product created successfully.",
      });
      await fetchProducts();
      await fetchCategories();
    } catch (err) {
      const d = err.response?.data;
      const detail = [d?.sqlMessage, d?.error].filter(Boolean).join(" — ");
      setProductMessage(
        detail || d?.message || err.message || "Failed to save product."
      );
    } finally {
      setProductSubmitting(false);
    }
  };

  const resetCreateFlow = () => {
    setCreateStep("idle");
    setNewAudience("");
    setNewCategoryName("");
  };

  const handleCreateCategoryClick = () => {
    setCreateStep("select-audience");
    setNewAudience("");
    setNewCategoryName("");
  };

  const handleAudiencePick = (value) => {
    setNewAudience(value);
    setCreateStep("enter-name");
  };

  const handleSubmitNewCategory = async () => {
    if (!newAudience || !newCategoryName.trim()) {
      setListMessage("Select audience and enter a category name.");
      return;
    }
    setIsSavingCategory(true);
    setListMessage("");
    try {
      await axios.post(`${API_BASE_URL}/api/categories`, {
        audience: newAudience,
        name: newCategoryName.trim(),
      });
      setAdminSaveModal({
        title: "Saved",
        message: "Category created successfully.",
      });
      resetCreateFlow();
      await fetchCategories();
    } catch (error) {
      setListMessage(
        error.response?.data?.message || "Failed to create category."
      );
    } finally {
      setIsSavingCategory(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    setListMessage("");
    try {
      await axios.put(`${API_BASE_URL}/api/categories/${id}`, {
        name: editName.trim(),
      });
      setAdminSaveModal({
        title: "Saved",
        message: "Category updated.",
      });
      setEditingId(null);
      await fetchCategories();
    } catch (error) {
      setListMessage(error.response?.data?.message || "Failed to update category.");
    }
  };

  const openDeleteModal = (row) => {
    setPendingDelete({
      id: row.id,
      name: row.name,
      audienceLabel: row.audienceLabel,
    });
  };

  const closeDeleteModal = () => {
    if (isDeletingCategory) return;
    setPendingDelete(null);
  };

  const confirmDeleteCategory = async () => {
    if (!pendingDelete) return;
    setIsDeletingCategory(true);
    setListMessage("");
    try {
      await axios.delete(`${API_BASE_URL}/api/categories/${pendingDelete.id}`);
      setAdminSaveModal({
        title: "Deleted",
        message: "Category deleted.",
      });
      setPendingDelete(null);
      await fetchCategories();
    } catch (error) {
      setListMessage(error.response?.data?.message || "Failed to delete category.");
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <main className="admin-login-page">
      <div className="container-fluid py-4">
        <section className="customize-dashboard">
          <AdminBusinessSidebar activeItem={businessSection} onBusinessSection={handleSidebarSection} />

          <section className="customize-main">
            <h1 className="mb-2">Customise Business</h1>
            <p className="admin-subtitle mb-4">
              {businessSection === "categories"
                ? "Business & Category Management"
                : businessSection === "products"
                  ? "Manage products, pricing, and inventory."
                  : businessSection === "users"
                    ? "Registered customers and account status."
                    : businessSection === "order_details"
                      ? "Paid orders — add tracking and mark as shipped."
                      : businessSection === "order_shipped"
                        ? "In transit — confirm when the customer receives the order."
                        : businessSection === "order_delivered"
                          ? "Completed deliveries."
                          : businessSection === "support_queries"
                            ? "Customer support — respond and close tickets."
                            : businessSection === "contact_form"
                              ? "Get in Touch — review messages from the public contact page."
                              : ""}
            </p>

            {businessSection === "categories" && (
            <section className="customize-workspace over-bg-panel">
              <div className="over-bg-head d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <h2 className="mb-1">Categories</h2>
                  <p className="mb-0">Create and manage product categories by audience.</p>
                </div>
                <button
                  type="button"
                  className="btn admin-submit-btn"
                  onClick={handleCreateCategoryClick}
                  disabled={createStep !== "idle"}
                >
                  Create category
                </button>
              </div>

              <div className="row mt-2">
                <div className="col-12 col-md-8 col-lg-5">
                  <label htmlFor="category-search" className="form-label visually-hidden">
                    Search categories
                  </label>
                  <input
                    id="category-search"
                    type="search"
                    className="form-control"
                    placeholder="Search categories by name or audience…"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {createStep !== "idle" && (
                <div className="business-create-panel mt-3">
                  {createStep === "select-audience" && (
                    <>
                      <p className="home-preview-label mb-2">Who is this category for?</p>
                      <div className="d-flex flex-wrap gap-2">
                        {AUDIENCE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className="btn admin-submit-btn"
                            onClick={() => handleAudiencePick(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-link text-dark p-0 mt-2"
                        onClick={resetCreateFlow}
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {createStep === "enter-name" && (
                    <>
                      <p className="mb-2">
                        <strong>
                          {AUDIENCE_OPTIONS.find((o) => o.value === newAudience)?.label}
                        </strong>
                      </p>
                      <label className="form-label">Category name</label>
                      <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="Enter category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn admin-submit-btn"
                          disabled={isSavingCategory || !newCategoryName.trim()}
                          onClick={handleSubmitNewCategory}
                        >
                          {isSavingCategory ? "Saving..." : "Submit"}
                        </button>
                        <button
                          type="button"
                          className="btn admin-submit-btn home-preview-btn"
                          onClick={() => setCreateStep("select-audience")}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          className="btn admin-submit-btn home-preview-btn"
                          onClick={resetCreateFlow}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {listMessage && (
                <p className="admin-description mt-3 mb-0">{listMessage}</p>
              )}

              <div className="table-responsive mt-3">
                <table className="table align-middle mb-0 business-categories-table">
                  <thead>
                    <tr>
                      <th scope="col">To whom</th>
                      <th scope="col">Category name</th>
                      <th scope="col">Created</th>
                      <th scope="col">Products</th>
                      <th scope="col" className="text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!categories.length ? (
                      <tr>
                        <td colSpan="5">No categories yet. Click Create category to add one.</td>
                      </tr>
                    ) : !filteredCategories.length ? (
                      <tr>
                        <td colSpan="5">No categories match your search.</td>
                      </tr>
                    ) : (
                      filteredCategories.map((row) => (
                        <tr key={row.id}>
                          <td>{row.audienceLabel}</td>
                          <td>
                            {editingId === row.id ? (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.productCount}</td>
                          <td className="text-end">
                            {editingId === row.id ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm admin-submit-btn me-1"
                                  onClick={() => saveEdit(row.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm admin-submit-btn home-preview-btn"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-icon admin-submit-btn me-1"
                                  title="Edit category name"
                                  onClick={() => startEdit(row)}
                                  aria-label="Edit"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                    aria-hidden
                                  >
                                    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon admin-submit-btn home-preview-btn"
                                  title="Delete category"
                                  onClick={() => openDeleteModal(row)}
                                  aria-label="Delete"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                    aria-hidden
                                  >
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}

            {businessSection === "users" && (
            <section className="customize-workspace over-bg-panel">
              <div className="over-bg-head">
                <h2 className="mb-1">Users</h2>
                <p className="mb-0">Registered customers. Banning blocks that email from signing in or using the store.</p>
              </div>
              {usersMessage ? (
                <p className="small mt-2 mb-0 text-danger">{usersMessage}</p>
              ) : null}
              <div className="table-responsive mt-3">
                <table className="table table-hover align-middle admin-users-table mb-0">
                  <thead>
                    <tr>
                      <th scope="col">First name</th>
                      <th scope="col">Last name</th>
                      <th scope="col">Email</th>
                      <th scope="col">User created</th>
                      <th scope="col" className="text-center">
                        Ban
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-muted text-center py-4">
                          No users yet.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.id}>
                          <td>{u.firstName}</td>
                          <td>{u.lastName}</td>
                          <td>{u.email}</td>
                          <td>
                            {u.createdAt ? new Date(u.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className={`btn btn-sm border-0 p-1 admin-user-ban-toggle ${u.banned ? "text-success" : "text-danger"}`}
                              title={u.banned ? "Unban user" : "Ban user"}
                              disabled={banBusyId === u.id}
                              onClick={() => toggleUserBan(u)}
                              aria-label={u.banned ? "Unban user" : "Ban user"}
                            >
                              {u.banned ? (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <path
                                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                                    fill="currentColor"
                                  />
                                </svg>
                              ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                                  <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}

            {(businessSection === "order_details" ||
              businessSection === "order_shipped" ||
              businessSection === "order_delivered") && (
              <AdminOrderFulfillment
                view={
                  businessSection === "order_details"
                    ? "pending"
                    : businessSection === "order_shipped"
                      ? "shipped"
                      : "delivered"
                }
                adminHeaders={stableAdminHeaders}
                onSuccessNotice={(msg) =>
                  setAdminSaveModal({
                    title: "Saved",
                    message: msg,
                  })
                }
              />
            )}

            {businessSection === "support_queries" && (
              <AdminSupportQueriesPanel adminHeaders={stableAdminHeaders} />
            )}

            {businessSection === "contact_form" && (
              <AdminContactPanel
                adminHeaders={stableAdminHeaders}
                onSaveSuccess={() =>
                  setAdminSaveModal({
                    title: "Saved",
                    message: "Contact entry saved.",
                  })
                }
              />
            )}

            {businessSection === "products" && (
            <section className="customize-workspace over-bg-panel add-product-workspace">
              <div className="over-bg-head d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <h2 className="mb-1">Products</h2>
                  <p className="mb-0">View inventory and add new products. Final price follows original price and offer %.</p>
                </div>
                <button
                  type="button"
                  className="btn admin-submit-btn"
                  onClick={openAddProductForm}
                  disabled={showProductForm}
                >
                  Add product
                </button>
              </div>

              <div className="row mt-2">
                <div className="col-12 col-md-8 col-lg-5">
                  <label htmlFor="product-search" className="form-label visually-hidden">
                    Search products
                  </label>
                  <input
                    id="product-search"
                    type="search"
                    className="form-control"
                    placeholder="Search products by title, category, or stock…"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              {showProductForm && (
              <div className="business-create-panel mt-3">
                <h3 className="h6 fw-bold mb-3">
                  {editingProductId ? "Edit product" : "New product"}
                </h3>
              <form
                key={productFormKey}
                className="add-product-form"
                onSubmit={handleSubmitProduct}
              >
                <div className="add-product-grid">
                  <div className="add-product-images">
                    <p className="home-preview-label mb-2">
                      Product images (optional, up to four — add in order; detail page shows only uploaded photos)
                    </p>
                    <div className="product-image-slots">
                      {[0, 1, 2, 3].map((i) => (
                        <label key={i} className="product-image-slot">
                          {productImageSlotSrc(i) ? (
                            <img
                              src={productImageSlotSrc(i)}
                              alt=""
                              className="product-image-thumb"
                              key={
                                imageFiles[i]
                                  ? imagePreviewUrls[i] || `new-${i}`
                                  : `slot-${editingProductId}-${i}-${editingProductUpdatedAt}`
                              }
                            />
                          ) : (
                            <span className="product-image-placeholder">+ Image {i + 1}</span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="product-image-input"
                            onChange={(e) => handleProductImageChange(i, e.target.files)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="add-product-fields">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={productTitle}
                      onChange={(e) => setProductTitle(e.target.value)}
                      placeholder="Product title"
                      required
                    />

                    <div className="row g-2 mb-3">
                      <div className="col-md-4">
                        <label className="form-label">Original price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control"
                          value={originalPrice}
                          onChange={(e) => setOriginalPrice(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Offer (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="form-control"
                          value={offerPercent}
                          onChange={(e) => setOfferPercent(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Price after offer</label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly
                          value={finalPriceDisplay}
                          aria-readonly="true"
                        />
                      </div>
                    </div>

                    <label className="form-label">Category</label>
                    <select
                      className="form-select mb-3"
                      value={productCategoryId}
                      onChange={(e) => setProductCategoryId(e.target.value)}
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.audienceLabel} — {c.name}
                        </option>
                      ))}
                    </select>

                    <div className="mb-3">
                      <label className="form-label d-block">Sizes (select one or more)</label>
                      <div className="product-size-chips" role="group" aria-label="Sizes">
                        {PRODUCT_SIZE_OPTIONS.map((size) => (
                          <button
                            key={size}
                            type="button"
                            className={`product-size-chip ${selectedSizes.has(size) ? "active" : ""}`}
                            onClick={() => toggleProductSize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="form-label">Quantity available</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="form-control mb-3"
                      value={quantityAvailable}
                      onChange={(e) => setQuantityAvailable(e.target.value)}
                      placeholder="0"
                      required
                    />

                    <div className="row g-2 mb-2">
                      <div className="col-md-6">
                        <label className="form-label">Fabric</label>
                        <input
                          type="text"
                          className="form-control"
                          value={fabric}
                          onChange={(e) => setFabric(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Color</label>
                        <input
                          type="text"
                          className="form-control"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="row g-2 mb-2">
                      <div className="col-md-6">
                        <label className="form-label">Print</label>
                        <input
                          type="text"
                          className="form-control"
                          value={printStyle}
                          onChange={(e) => setPrintStyle(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Body fit</label>
                        <input
                          type="text"
                          className="form-control"
                          value={bodyFit}
                          onChange={(e) => setBodyFit(e.target.value)}
                        />
                      </div>
                    </div>

                    <label className="form-label">Features</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={features}
                      onChange={(e) => setFeatures(e.target.value)}
                    />

                    <label className="form-label">Neck type</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={neckType}
                      onChange={(e) => setNeckType(e.target.value)}
                    />

                    <label className="form-label">Product details</label>
                    <textarea
                      className="form-control mb-3"
                      rows={4}
                      value={productDetails}
                      onChange={(e) => setProductDetails(e.target.value)}
                      placeholder="Full product description"
                    />

                    <label className="form-label">Shipment and delivery</label>
                    <textarea
                      className="form-control mb-3"
                      rows={3}
                      value={shipmentDelivery}
                      onChange={(e) => setShipmentDelivery(e.target.value)}
                    />

                    <label className="form-label">Return and exchange</label>
                    <textarea
                      className="form-control mb-3"
                      rows={3}
                      value={returnExchange}
                      onChange={(e) => setReturnExchange(e.target.value)}
                    />

                    {productMessage && (
                      <p className="admin-description mb-3">{productMessage}</p>
                    )}

                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="btn admin-submit-btn"
                        disabled={productSubmitting}
                      >
                        {productSubmitting
                          ? "Saving…"
                          : editingProductId
                            ? "Update product"
                            : "Save product"}
                      </button>
                      <button
                        type="button"
                        className="btn admin-submit-btn home-preview-btn"
                        onClick={closeProductForm}
                        disabled={productSubmitting}
                      >
                        Cancel
                      </button>
                      {!editingProductId && (
                        <button
                          type="button"
                          className="btn admin-submit-btn home-preview-btn"
                          onClick={() => {
                            resetProductForm();
                            setProductMessage("");
                          }}
                          disabled={productSubmitting}
                        >
                          Clear form
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
              </div>
              )}

              {productListMessage && (
                <p className="admin-description mt-3 mb-0">{productListMessage}</p>
              )}

              <div className="table-responsive mt-3">
                <table className="table align-middle mb-0 business-categories-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Added</th>
                      <th scope="col">Items left</th>
                      <th scope="col">Category</th>
                      <th scope="col" className="text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!productList.length ? (
                      <tr>
                        <td colSpan="5">
                          No products yet. Click Add product to create one.
                        </td>
                      </tr>
                    ) : !filteredProducts.length ? (
                      <tr>
                        <td colSpan="5">No products match your search.</td>
                      </tr>
                    ) : (
                      filteredProducts.map((row) => (
                        <tr key={row.id}>
                          <td>{row.title}</td>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>{row.quantityAvailable}</td>
                          <td>{row.categoryLabel}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-icon admin-submit-btn me-1"
                              title="Edit product"
                              onClick={() => startEditProduct(row)}
                              disabled={showProductForm}
                              aria-label="Edit"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                fill="currentColor"
                                viewBox="0 0 16 16"
                                aria-hidden
                              >
                                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="btn btn-icon admin-submit-btn home-preview-btn"
                              title="Delete product"
                              onClick={() => openDeleteProductModal(row)}
                              disabled={showProductForm}
                              aria-label="Delete"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                fill="currentColor"
                                viewBox="0 0 16 16"
                                aria-hidden
                              >
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                <path
                                  fillRule="evenodd"
                                  d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}
          </section>
        </section>
      </div>

      {pendingDelete && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={closeDeleteModal}
        >
          <div
            className="admin-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-category-title" className="admin-modal-title">
              Delete category?
            </h3>
            <p className="admin-modal-body mb-0">
              This will remove{" "}
              <strong>{pendingDelete.name}</strong> ({pendingDelete.audienceLabel}). This
              cannot be undone.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn admin-submit-btn home-preview-btn"
                onClick={closeDeleteModal}
                disabled={isDeletingCategory}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn admin-submit-btn"
                onClick={confirmDeleteCategory}
                disabled={isDeletingCategory}
              >
                {isDeletingCategory ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingProductDelete && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={closeDeleteProductModal}
        >
          <div
            className="admin-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-product-title" className="admin-modal-title">
              Delete product?
            </h3>
            <p className="admin-modal-body mb-0">
              This will remove <strong>{pendingProductDelete.title}</strong>. This cannot be
              undone.
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="btn admin-submit-btn home-preview-btn"
                onClick={closeDeleteProductModal}
                disabled={isDeletingProduct}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn admin-submit-btn"
                onClick={confirmDeleteProduct}
                disabled={isDeletingProduct}
              >
                {isDeletingProduct ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {adminSaveModal ? (
        <div
          className="website-contact-success-backdrop"
          role="presentation"
          onClick={() => setAdminSaveModal(null)}
        >
          <div
            className="website-contact-success-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-business-save-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-business-save-modal-title" className="website-contact-success-title">
              {adminSaveModal.title}
            </h2>
            <p className="website-contact-success-body mb-0">{adminSaveModal.message}</p>
            <div className="website-contact-success-actions">
              <button
                type="button"
                className="btn admin-submit-btn"
                onClick={() => setAdminSaveModal(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
