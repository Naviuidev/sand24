import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";

const CATEGORY_OPTIONS = [
  { value: "purchase_problem", label: "Facing problem while purchasing" },
  { value: "payment_deducted_no_order", label: "Money got deducted but order not placed" },
  { value: "bulk_order_request", label: "Request bulk orders facility" },
  { value: "custom", label: "Custom query" },
];

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

/** Portal tooltip so details are visible (not clipped; works when resolved). */
function ProfileQueryNameCell({ q }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, maxWidth: 320 });
  const triggerRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const name = `${q.firstName || ""} ${q.lastName || ""}`.trim() || "—";

  const positionTip = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const maxW = Math.min(360, Math.max(260, vw - r.left - 16));
    let left = r.left;
    if (left + maxW > vw - 8) left = Math.max(8, vw - maxW - 8);
    setBox({ top: r.bottom + 8, left, maxWidth: maxW });
  }, []);

  const openTip = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    positionTip();
    setOpen(true);
  };

  const scheduleClose = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setOpen(false);
      leaveTimerRef.current = null;
    }, 200);
  };

  const cancelClose = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const upd = () => positionTip();
    window.addEventListener("scroll", upd, true);
    window.addEventListener("resize", upd);
    return () => {
      window.removeEventListener("scroll", upd, true);
      window.removeEventListener("resize", upd);
    };
  }, [open, positionTip]);

  const tip =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="customer-profile-query-tooltip"
            style={{
              position: "fixed",
              top: box.top,
              left: box.left,
              maxWidth: box.maxWidth,
              zIndex: 10050,
            }}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={() => setOpen(false)}
          >
            {q.email ? (
              <p>
                <span className="customer-profile-query-tooltip__k">Email</span>
                {q.email}
              </p>
            ) : null}
            {q.mobile ? (
              <p>
                <span className="customer-profile-query-tooltip__k">Mobile</span>
                {q.mobile}
              </p>
            ) : null}
            <p>
              <span className="customer-profile-query-tooltip__k">Topic</span>
              {q.categoryLabel || q.category || "—"}
            </p>
            {q.message && String(q.message).trim() && q.message !== "—" ? (
              <p>
                <span className="customer-profile-query-tooltip__k">Message</span>
                {q.message}
              </p>
            ) : null}
            {q.adminNote && String(q.adminNote).trim() ? (
              <p>
                <span className="customer-profile-query-tooltip__k">Team reply</span>
                {q.adminNote}
              </p>
            ) : null}
            {q.status === "completed" ? (
              <p className="text-muted small mb-0">
                This query has been updated as resolved. You can raise a new query if you need further help.
              </p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <td className="customer-profile-queries-table__name">
      <span
        ref={triggerRef}
        className="customer-profile-queries-table__name-trigger"
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
      >
        {name}
      </span>
      {tip}
    </td>
  );
}

export default function ProfileQueriesPanel() {
  const { user, token } = useAuth();
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  /** "raise" = form, "thanks" = confirmation after successful submit */
  const [modalPhase, setModalPhase] = useState("raise");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [category, setCategory] = useState("purchase_problem");
  const [message, setMessage] = useState("");

  const needsCustomMessage = category === "custom";

  const loadQueries = async () => {
    setLoadError("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/me/queries`);
      setQueries(data?.data || []);
    } catch (e) {
      setLoadError(e.response?.data?.message || "Could not load queries.");
      setQueries([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/queries`);
        if (!cancelled) setQueries(data?.data || []);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message || "Could not load queries.");
          setQueries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!user || !modalOpen || modalPhase !== "raise") return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setEmail(user.email || "");
    setMobile("");
    setCategory("purchase_problem");
    setMessage("");
    setFormError("");
  }, [user, modalOpen, modalPhase]);

  function closeModal() {
    setModalOpen(false);
    setModalPhase("raise");
  }

  function openModal() {
    setFormError("");
    setModalPhase("raise");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!user || !token) {
      setFormError("Please sign in to raise a query.");
      return;
    }
    if (needsCustomMessage && message.trim().length < 4) {
      setFormError("Please describe your query (at least 4 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/api/me/queries`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        mobile: mobile.replace(/\D/g, ""),
        category,
        message: needsCustomMessage ? message.trim() : message.trim(),
      });
      await loadQueries();
      setModalPhase("thanks");
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedQueries = useMemo(() => {
    const list = [...queries];
    list.sort((a, b) => Number(b.id) - Number(a.id));
    return list;
  }, [queries]);

  if (loading) {
    return <p className="text-center text-muted mb-0">Loading queries…</p>;
  }

  return (
    <div className="customer-profile-queries">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="customer-profile-section__title mb-0">Raised queries</h2>
        <button type="button" className="btn btn-sm customer-profile-queries__raise-btn" onClick={openModal}>
          Raise a new query
        </button>
      </div>

      {loadError ? (
        <p className="text-danger small" role="alert">
          {loadError}
        </p>
      ) : null}

      {sortedQueries.length === 0 && !loadError ? (
        <p className="text-muted mb-0 text-center">
          You have not raised any queries yet. Use <strong>Raise a new query</strong> if you need help.
        </p>
      ) : (
        <div className="table-responsive customer-profile-queries__table-wrap">
          <table className="table table-sm align-middle mb-0 customer-profile-queries-table">
            <thead className="table-light">
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Topic</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sortedQueries.map((q) => {
                const resolved = q.status === "completed";
                return (
                  <tr
                    key={q.id}
                    className={resolved ? "customer-profile-queries-table__row--resolved" : ""}
                  >
                    <td className="text-muted small">{q.id}</td>
                    <ProfileQueryNameCell q={q} />
                    <td className="small">{q.categoryLabel || q.category}</td>
                    <td>
                      <span
                        className={`badge rounded-pill customer-profile-queries__badge customer-profile-queries__badge--${resolved ? "done" : "pending"}`}
                      >
                        {resolved ? "Resolved" : "Pending"}
                      </span>
                    </td>
                    <td className="small text-nowrap">{formatWhen(q.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div
          className="customer-query-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (submitting) return;
            closeModal();
          }}
        >
          <div
            className="customer-query-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-query-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="customer-query-modal-title" className="customer-query-modal-title">
              {modalPhase === "thanks" ? "Thank you" : "Raise a query"}
            </h3>
            {!user || !token ? (
              <p className="mb-0">
                Please{" "}
                <Link to="/login" state={{ from: "/profile?tab=queries" }}>
                  sign in
                </Link>{" "}
                to submit a query.
              </p>
            ) : modalPhase === "thanks" ? (
              <>
                <p className="mb-3 customer-query-modal-thanks">
                  Thanks for reaching out! We will get in touch shortly.
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-sm customer-profile-queries__raise-btn"
                    onClick={closeModal}
                  >
                    OK
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="customer-query-modal-form">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small mb-1" htmlFor="cq-first">
                      First name
                    </label>
                    <input
                      id="cq-first"
                      className="form-control form-control-sm"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small mb-1" htmlFor="cq-last">
                      Last name
                    </label>
                    <input
                      id="cq-last"
                      className="form-control form-control-sm"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="form-label small mb-1" htmlFor="cq-email">
                    Email
                  </label>
                  <input
                    id="cq-email"
                    type="email"
                    className="form-control form-control-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small mb-1" htmlFor="cq-mobile">
                    Mobile number
                  </label>
                  <input
                    id="cq-mobile"
                    inputMode="numeric"
                    className="form-control form-control-sm"
                    placeholder="10-digit mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required
                    autoComplete="tel"
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small mb-1" htmlFor="cq-cat">
                    What do you need help with?
                  </label>
                  <select
                    id="cq-cat"
                    className="form-select form-select-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {needsCustomMessage ? (
                  <div className="mt-2">
                    <label className="form-label small mb-1" htmlFor="cq-msg">
                      Your message
                    </label>
                    <textarea
                      id="cq-msg"
                      className="form-control form-control-sm"
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue…"
                      required
                    />
                  </div>
                ) : null}
                {formError ? (
                  <p className="text-danger small mt-2 mb-0" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className="d-flex flex-wrap gap-2 justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={submitting}
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm customer-profile-queries__raise-btn" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
