import { useState } from "react";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";

const CONTACT_HERO_SRC = `${import.meta.env.BASE_URL}assets/images/Group142.png`;

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/api/contact`, {
        fullName: fullName.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setFullName("");
      setEmail("");
      setMessage("");
      setSuccessModalOpen(true);
    } catch (err) {
      const status = err.response?.status;
      let msg =
        err.response?.data?.message || err.message || "Something went wrong. Please try again.";
      if (status === 404) {
        msg =
          "Could not reach the contact API (404). Start the backend on port 5001, or set VITE_API_BASE_URL when using vite preview / production.";
      }
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  function closeSuccessModal() {
    setSuccessModalOpen(false);
  }

  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-contact-main">
        <section className="website-contact-hero" aria-labelledby="contact-page-heading">
          <div className="container">
            <h1 id="contact-page-heading" className="website-contact-hero__title">
              Get in Touch
            </h1>

            <div className="row align-items-start g-4 g-lg-5 mt-2 mt-lg-3 website-contact-hero__row">
              <div className="col-12 col-lg-8 order-2 order-lg-1">
                <div className="website-contact-visual" aria-hidden="true">
                  <img
                    src={CONTACT_HERO_SRC}
                    alt=""
                    className="website-contact-visual__img"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <div className="col-12 col-lg-4 order-1 order-lg-2">
                <form className="website-contact-form" onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="contact-full-name" className="website-contact-form__label">
                      Full Name
                    </label>
                    <input
                      id="contact-full-name"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      className="form-control website-contact-form__input"
                      placeholder="Enter"
                      value={fullName}
                      onChange={(ev) => setFullName(ev.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="contact-email" className="website-contact-form__label">
                      Email
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className="form-control website-contact-form__input"
                      placeholder="Enter"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="contact-message" className="website-contact-form__label">
                      Enter Message
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      className="form-control website-contact-form__textarea"
                      placeholder="Enter"
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      required
                      disabled={busy}
                    />
                  </div>
                  {errorMessage ? (
                    <p className="website-contact-form__feedback text-danger small mb-3" role="alert">
                      {errorMessage}
                    </p>
                  ) : null}
                  <button type="submit" className="btn website-contact-form__submit w-100" disabled={busy}>
                    {busy ? "Sending…" : "Submit"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {successModalOpen ? (
        <div
          className="website-contact-success-backdrop"
          role="presentation"
          onClick={closeSuccessModal}
        >
          <div
            className="website-contact-success-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-success-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="contact-success-title" className="website-contact-success-title">
              Message sent
            </h2>
            <p className="website-contact-success-body mb-0">
              Thank you — we have received your message and will get back to you soon.
            </p>
            <div className="website-contact-success-actions">
              <button
                type="button"
                className="btn website-contact-form__submit"
                onClick={closeSuccessModal}
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
