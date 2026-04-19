import { useState } from "react";
import { Link } from "react-router-dom";

const FOOTER_BRANCH_LEFT_URL = "/assets/images/footer/branch-left.png";
const FOOTER_BRANCH_RIGHT_URL = "/assets/images/footer/branch-right.png";
const FOOTER_LOGO_WHITE_URL = "/assets/images/footer/sand24-logo-white.png";
const CONTACT_MODAL_LOGO_URL = "/sand24-logo-mark.png";

const SUPPORT_EMAIL = "support@sand24.in";
const SUPPORT_PHONE = "9839834592";
const WHATSAPP_LINK = `https://wa.me/91${SUPPORT_PHONE}`;

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function CopyClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z" />
    </svg>
  );
}

function FooterContactCopyRow({ value, copyLabel }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <div className="footer-contact-modal__copy-row">
      <span className="footer-contact-modal__value" title={value}>
        {value}
      </span>
      <button
        type="button"
        className="footer-contact-modal__copy-btn"
        onClick={handleCopy}
        aria-label={copyLabel}
        title={copyLabel}
      >
        <CopyClipboardIcon />
      </button>
      {copied ? (
        <span className="footer-contact-modal__copied" role="status">
          Copied
        </span>
      ) : null}
    </div>
  );
}

export default function PublicSiteFooter() {
  const [contactModal, setContactModal] = useState(null);

  return (
    <footer id="contact" className="website-public-footer" aria-labelledby="footer-heading">
      <div className="website-public-footer__branches" aria-hidden="true">
        <img
          src={FOOTER_BRANCH_LEFT_URL}
          alt=""
          className="website-public-footer__branch website-public-footer__branch--left"
          width={581}
          height={642}
          loading="lazy"
          decoding="async"
        />
        <img
          src={FOOTER_BRANCH_RIGHT_URL}
          alt=""
          className="website-public-footer__branch website-public-footer__branch--right"
          width={476}
          height={507}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="container website-public-footer__inner">
        <h2 id="footer-heading" className="visually-hidden">
          Sand24 footer
        </h2>
        <form
          className="website-public-footer__signup"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="website-public-footer__signup-shell">
            <label htmlFor="footer-email" className="visually-hidden">
              Email address
            </label>
            <input
              id="footer-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              className="website-public-footer__signup-input"
            />
            <button type="submit" className="website-public-footer__signup-btn">
              Sign me up
              <span className="website-public-footer__signup-arrow" aria-hidden>
                →
              </span>
            </button>
          </div>
        </form>

        <div className="website-public-footer__brand">
          <a href="/" className="website-public-footer__brand-link">
            <img
              src={FOOTER_LOGO_WHITE_URL}
              alt="Sand 24 — Fashion from nature"
              className="website-public-footer__logo-img"
              width={1003}
              height={173}
            />
          </a>
        </div>

        <nav className="website-public-footer__nav row g-4 g-lg-5" aria-label="Footer">
          <div className="col-6 col-lg-3">
            <h3 className="website-public-footer__col-title">About Us</h3>
            <ul className="website-public-footer__list list-unstyled mb-0">
              <li>
                <Link to="/story" className="website-public-footer__link">
                  Company
                </Link>
              </li>
              <li>
                <Link to="/journal" className="website-public-footer__link">
                  Journal
                </Link>
              </li>
              <li>
                <Link to="/sustainability" className="website-public-footer__link">
                  Sustainability
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-6 col-lg-3">
            <h3 className="website-public-footer__col-title">Help</h3>
            <ul className="website-public-footer__list list-unstyled mb-0">
              <li>
                <Link to="/profile?tab=orders" className="website-public-footer__link">
                  Track Order
                </Link>
              </li>
              <li>
                <Link to="/returns-refund" className="website-public-footer__link">
                  Returns &amp; Refund
                </Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="website-public-footer__link">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="website-public-footer__link">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div className="col-6 col-lg-3">
            <h3 className="website-public-footer__col-title">Contact Us</h3>
            <ul className="website-public-footer__list list-unstyled mb-0">
              <li>
                <Link to="/contact" className="website-public-footer__link">
                  Get in Touch
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="website-public-footer__link website-public-footer__link--button"
                  onClick={() => setContactModal("email")}
                >
                  Email
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="website-public-footer__link website-public-footer__link--button"
                  onClick={() => setContactModal("phone")}
                >
                  Contact Number
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="website-public-footer__link website-public-footer__link--button"
                  onClick={() => setContactModal("whatsapp")}
                >
                  Whatsapp
                </button>
              </li>
            </ul>
          </div>
          <div className="col-6 col-lg-3">
            <h3 className="website-public-footer__col-title">Follow Us on</h3>
            <ul className="website-public-footer__list list-unstyled mb-0">
              <li>
                <a
                  href="https://www.instagram.com/sand24.in?igsh=MWFueXBrbWl6cm1qag=="
                  className="website-public-footer__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/sand24.in"
                  className="website-public-footer__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/sand24.in"
                  className="website-public-footer__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/@sand24.in"
                  className="website-public-footer__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Youtube
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      {contactModal ? (
        <div
          className="footer-contact-modal-backdrop"
          role="presentation"
          onClick={() => setContactModal(null)}
        >
          <div
            className="footer-contact-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-contact-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="footer-contact-modal-close"
              onClick={() => setContactModal(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="footer-contact-modal-brand">
              <img
                src={CONTACT_MODAL_LOGO_URL}
                alt=""
                width={120}
                height={40}
                className="footer-contact-modal-logo"
              />
            </div>
            <h3 id="footer-contact-modal-title" className="footer-contact-modal-title">
              {contactModal === "email"
                ? "Email"
                : contactModal === "phone"
                  ? "Contact number"
                  : "WhatsApp"}
            </h3>
            {contactModal === "email" ? (
              <FooterContactCopyRow value={SUPPORT_EMAIL} copyLabel="Copy email address" />
            ) : null}
            {contactModal === "phone" ? (
              <FooterContactCopyRow value={SUPPORT_PHONE} copyLabel="Copy phone number" />
            ) : null}
            {contactModal === "whatsapp" ? (
              <>
                <FooterContactCopyRow value={SUPPORT_PHONE} copyLabel="Copy WhatsApp number" />
                <p className="footer-contact-modal-hint mb-0">
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="footer-contact-modal-wa-link">
                    Open in WhatsApp
                  </a>
                </p>
              </>
            ) : null}
            <div className="footer-contact-modal-actions">
              <button type="button" className="btn website-contact-form__submit" onClick={() => setContactModal(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
