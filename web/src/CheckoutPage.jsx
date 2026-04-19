import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { INDIAN_STATES, districtsForState } from "./data/indiaStatesDistricts.js";
import { formatRupeeInr, productImageSrc } from "./productUtils.js";

const emptyAddressForm = () => ({
  addressLine1: "",
  landmark: "",
  state: "",
  district: "",
  city: "",
  pincode: "",
});

/** Build address payload for payment API (nothing persisted until payment succeeds). */
function snapshotFromForm(form) {
  return {
    addressLine1: form.addressLine1.trim(),
    landmark: form.landmark.trim(),
    state: form.state,
    district: form.district,
    city: form.city.trim(),
    pincode: form.pincode.trim(),
  };
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const checkoutState = location.state;
  const lines = checkoutState?.lines;
  const orderTotal = typeof checkoutState?.orderTotal === "number" ? checkoutState.orderTotal : 0;

  const [form, setForm] = useState(() => emptyAddressForm());
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(() => emptyAddressForm());
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [sessionPickOpen, setSessionPickOpen] = useState(false);
  const [selectedPickIndex, setSelectedPickIndex] = useState(0);

  const districtOptions = useMemo(() => districtsForState(form.state), [form.state]);
  const addDistrictOptions = useMemo(() => districtsForState(addForm.state), [addForm.state]);

  const pickOptions = useMemo(() => {
    const primary = {
      key: "form",
      label: "Address from the form above",
      address: snapshotFromForm(form),
    };
    const saved = savedAddresses.map((row) => ({
      key: `saved-${row.id}`,
      label: `Saved — ${row.city}, ${row.district}`,
      address: {
        addressLine1: row.addressLine1,
        landmark: row.landmark || "",
        state: row.state,
        district: row.district,
        city: row.city,
        pincode: row.pincode,
      },
    }));
    return [primary, ...saved];
  }, [form, savedAddresses]);

  const prefillFromProfile = useCallback(() => {
    if (!user?.shippingAddress) return;
    const s = user.shippingAddress;
    setForm({
      addressLine1: s.addressLine1 || "",
      landmark: s.landmark || "",
      state: s.state || "",
      district: s.district || "",
      city: s.city || "",
      pincode: s.pincode || "",
    });
  }, [user?.shippingAddress]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/checkout" } });
      return;
    }
    prefillFromProfile();
    setReady(true);
  }, [authLoading, user, navigate, prefillFromProfile]);

  useEffect(() => {
    if (!form.state || !form.district) return;
    const opts = districtsForState(form.state);
    if (opts.length && !opts.includes(form.district)) {
      setForm((prev) => ({ ...prev, district: "" }));
    }
  }, [form.state, form.district]);

  useEffect(() => {
    if (!addForm.state || !addForm.district) return;
    const opts = districtsForState(addForm.state);
    if (opts.length && !opts.includes(addForm.district)) {
      setAddForm((prev) => ({ ...prev, district: "" }));
    }
  }, [addForm.state, addForm.district]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!lines?.length) {
      navigate("/products", { replace: true });
    }
  }, [authLoading, user, lines, navigate]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setAddressesLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/addresses`);
        if (!cancelled) setSavedAddresses(data?.data || []);
      } catch {
        if (!cancelled) setSavedAddresses([]);
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    setSelectedPickIndex((i) => {
      const max = Math.max(0, pickOptions.length - 1);
      return i > max ? 0 : i;
    });
  }, [pickOptions.length]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError("");
  }

  function updateAddField(key, value) {
    setAddForm((prev) => ({ ...prev, [key]: value }));
    setAddError("");
  }

  function openAddModal() {
    setAddForm(emptyAddressForm());
    setAddError("");
    setAddModalOpen(true);
  }

  async function handleAddAddressSubmit(e) {
    e.preventDefault();
    setAddError("");
    const a = addForm;
    if (!a.addressLine1.trim()) {
      setAddError("Address line 1 is required.");
      return;
    }
    if (!a.state || !a.district || !a.city.trim()) {
      setAddError("State, district, and city are required.");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(a.pincode.trim())) {
      setAddError("Enter a valid 6-digit PIN code.");
      return;
    }

    setAddSaving(true);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/me/addresses`, {
        addressLine1: a.addressLine1.trim(),
        landmark: a.landmark.trim(),
        state: a.state,
        district: a.district,
        city: a.city.trim(),
        pincode: a.pincode.trim(),
      });
      const row = data?.data;
      if (row?.id) {
        setSavedAddresses((prev) => {
          const next = prev.filter((x) => x.id !== row.id);
          return [row, ...next];
        });
      } else {
        const { data: list } = await axios.get(`${API_BASE_URL}/api/me/addresses`);
        setSavedAddresses(list?.data || []);
      }
      await refreshUser?.();
      setAddModalOpen(false);
    } catch (err) {
      setAddError(err.response?.data?.message || "Could not save address.");
    } finally {
      setAddSaving(false);
    }
  }

  function validateMainForm() {
    if (!form.addressLine1.trim()) {
      setFormError("Address line 1 is required.");
      return false;
    }
    if (!form.state || !form.district || !form.city.trim()) {
      setFormError("State, district, and city are required.");
      return false;
    }
    if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
      setFormError("Enter a valid 6-digit PIN code.");
      return false;
    }
    return true;
  }

  async function startPayment(addressPayload) {
    setSaving(true);
    setFormError("");
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/me/payment/init`, {
        lines,
        orderTotal,
        address: addressPayload,
      });
      const url = data?.data?.redirectUrl;
      if (!url) {
        setFormError("Payment could not be started. Try again.");
        return;
      }
      window.location.href = url;
    } catch (err) {
      setFormError(err.response?.data?.message || "Could not start payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!validateMainForm()) return;

    setSelectedPickIndex(0);
    setSessionPickOpen(true);
  }

  async function confirmSessionPick() {
    const opt = pickOptions[selectedPickIndex];
    if (!opt?.address) {
      setFormError("Please select an address.");
      return;
    }
    setSessionPickOpen(false);
    await startPayment(opt.address);
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

  if (!lines?.length) {
    return null;
  }

  return (
    <div className="website-home-page">
      <PublicSiteHeader />
      <main className="website-checkout-page website-checkout-page__main container">
        <nav className="website-product-detail__breadcrumb small mb-3" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden> / </span>
          <span className="text-muted">Checkout</span>
        </nav>

        <div className="website-checkout-page__heading-row">
          <h1 className="website-cart-page__title mb-0">Checkout</h1>
          <button type="button" className="btn website-checkout-page__add-address-btn" onClick={openAddModal}>
            Add address
          </button>
        </div>

        <p className="small text-muted mb-3">
          Delivery address is stored only after payment succeeds. Use Add address to keep extra options for this session
          only.
        </p>

        <form id="checkout-shipping-form" onSubmit={handleSubmit}>
          <div className="row g-4 g-lg-5 align-items-start">
            <div className="col-12 col-lg-7">
              <div className="website-checkout-page__panel">
                <h2 className="website-checkout-page__panel-title">Contact &amp; delivery</h2>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-firstname">
                      First name
                    </label>
                    <input
                      id="checkout-firstname"
                      type="text"
                      className="form-control website-checkout-page__input website-checkout-page__input--readonly"
                      readOnly
                      tabIndex={-1}
                      value={user.firstName || ""}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-lastname">
                      Last name
                    </label>
                    <input
                      id="checkout-lastname"
                      type="text"
                      className="form-control website-checkout-page__input website-checkout-page__input--readonly"
                      readOnly
                      tabIndex={-1}
                      value={user.lastName || ""}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-email">
                      Email
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      className="form-control website-checkout-page__input website-checkout-page__input--readonly"
                      readOnly
                      tabIndex={-1}
                      value={user.email || ""}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-addr1">
                      Address line 1 <span className="text-danger">*</span>
                    </label>
                    <input
                      id="checkout-addr1"
                      type="text"
                      className="form-control website-checkout-page__input"
                      autoComplete="address-line1"
                      value={form.addressLine1}
                      onChange={(e) => updateField("addressLine1", e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-landmark">
                      Landmark
                    </label>
                    <input
                      id="checkout-landmark"
                      type="text"
                      className="form-control website-checkout-page__input"
                      value={form.landmark}
                      onChange={(e) => updateField("landmark", e.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-state">
                      State <span className="text-danger">*</span>
                    </label>
                    <select
                      id="checkout-state"
                      className="form-select website-checkout-page__input"
                      value={form.state}
                      onChange={(e) => {
                        const next = e.target.value;
                        setForm((prev) => ({ ...prev, state: next, district: "" }));
                        setFormError("");
                      }}
                      required
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-district">
                      District <span className="text-danger">*</span>
                    </label>
                    <select
                      id="checkout-district"
                      className="form-select website-checkout-page__input"
                      value={form.district}
                      onChange={(e) => updateField("district", e.target.value)}
                      disabled={!form.state || districtOptions.length === 0}
                      required
                    >
                      <option value="">{form.state ? "Select district" : "Select state first"}</option>
                      {districtOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-city">
                      City <span className="text-danger">*</span>
                    </label>
                    <input
                      id="checkout-city"
                      type="text"
                      className="form-control website-checkout-page__input"
                      autoComplete="address-level2"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label website-checkout-page__label" htmlFor="checkout-pincode">
                      PIN code <span className="text-danger">*</span>
                    </label>
                    <input
                      id="checkout-pincode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="form-control website-checkout-page__input"
                      autoComplete="postal-code"
                      value={form.pincode}
                      onChange={(e) => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="website-checkout-page__panel website-checkout-page__panel--summary">
                <h2 className="website-checkout-page__panel-title">Order summary</h2>

                <ul className="list-unstyled website-checkout-page__lines mb-4">
                  {lines.map((line, idx) => (
                    <li
                      key={`${line.productId}-${line.sizeLabel || ""}-${idx}`}
                      className="website-checkout-page__line d-flex gap-3 pb-3 mb-3 border-bottom"
                    >
                      <img
                        src={productImageSrc(line.productId, 1)}
                        alt=""
                        className="website-checkout-page__line-thumb flex-shrink-0"
                        width={72}
                        height={90}
                      />
                      <div className="flex-grow-1 min-width-0">
                        <p className="website-checkout-page__line-title mb-1">{line.title}</p>
                        {line.sizeLabel ? (
                          <p className="small text-muted mb-1">Size: {line.sizeLabel}</p>
                        ) : null}
                        <p className="small text-muted mb-0">
                          Qty {line.quantity} × {formatRupeeInr(line.unitPrice)}
                        </p>
                      </div>
                      <div className="text-end flex-shrink-0">
                        <p className="website-checkout-page__line-price mb-0">{formatRupeeInr(line.lineTotal)}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="website-checkout-page__total-row d-flex justify-content-between align-items-baseline">
                  <span className="website-checkout-page__total-label">Total amount</span>
                  <span className="website-checkout-page__total-value">{formatRupeeInr(orderTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="website-checkout-page__after-form mt-4 pt-4">
            {formError && !sessionPickOpen ? (
              <p className="text-danger small mb-3" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="website-checkout-page__actions-row d-flex flex-column flex-sm-row flex-wrap align-items-start align-items-sm-center gap-2 gap-sm-3">
              <button type="submit" className="btn website-product-detail__btn-cart" disabled={saving || !ready}>
                {saving ? "Please wait…" : "Choose delivery address"}
              </button>
              <Link
                to={
                  checkoutState?.fromBuyNow && checkoutState?.sourceProductId
                    ? `/products/${checkoutState.sourceProductId}/buy-now`
                    : "/products"
                }
                className="btn btn-link btn-sm p-0 website-auth-forgot website-checkout-page__back-link"
              >
                Back to products
              </Link>
            </div>
          </div>
        </form>
      </main>

      {addModalOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => !addSaving && setAddModalOpen(false)}
        >
          <div
            className="website-auth-modal website-checkout-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-add-address-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="checkout-add-address-title" className="h6 website-checkout-page__modal-title mb-2">
              Add address
            </h2>
            <p className="small text-muted mb-3">
              Saves to your account and appears in the list when you choose a delivery address.
            </p>
            <form onSubmit={handleAddAddressSubmit} noValidate>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-addr1">
                    Address line 1 *
                  </label>
                  <input
                    id="add-addr1"
                    className="form-control form-control-sm"
                    value={addForm.addressLine1}
                    onChange={(e) => updateAddField("addressLine1", e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-landmark">
                    Landmark
                  </label>
                  <input
                    id="add-landmark"
                    className="form-control form-control-sm"
                    value={addForm.landmark}
                    onChange={(e) => updateAddField("landmark", e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-state">
                    State *
                  </label>
                  <select
                    id="add-state"
                    className="form-select form-select-sm"
                    value={addForm.state}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAddForm((prev) => ({ ...prev, state: next, district: "" }));
                      setAddError("");
                    }}
                    required
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-district">
                    District *
                  </label>
                  <select
                    id="add-district"
                    className="form-select form-select-sm"
                    value={addForm.district}
                    onChange={(e) => updateAddField("district", e.target.value)}
                    disabled={!addForm.state || addDistrictOptions.length === 0}
                    required
                  >
                    <option value="">{addForm.state ? "Select district" : "Select state first"}</option>
                    {addDistrictOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-city">
                    City *
                  </label>
                  <input
                    id="add-city"
                    className="form-control form-control-sm"
                    value={addForm.city}
                    onChange={(e) => updateAddField("city", e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label website-checkout-page__label small" htmlFor="add-pincode">
                    PIN code *
                  </label>
                  <input
                    id="add-pincode"
                    className="form-control form-control-sm"
                    inputMode="numeric"
                    maxLength={6}
                    value={addForm.pincode}
                    onChange={(e) => updateAddField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                </div>
              </div>
              {addError ? (
                <p className="text-danger small mt-2 mb-0" role="alert">
                  {addError}
                </p>
              ) : null}
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={addSaving}
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm website-product-detail__btn-cart" disabled={addSaving}>
                  {addSaving ? "Saving…" : "Save address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {sessionPickOpen ? (
        <div
          className="website-auth-modal-backdrop"
          role="presentation"
          onClick={() => !saving && setSessionPickOpen(false)}
        >
          <div
            className="website-auth-modal website-checkout-page__modal website-checkout-page__modal--select"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-session-pick-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="checkout-session-pick-title" className="h6 website-checkout-page__modal-title mb-2">
              Select delivery address
            </h2>
            <p className="small text-muted mb-3">
              Confirm which address to use for this order. You will be sent to PhonePe only after you continue here.
              {addressesLoading ? (
                <span className="d-block mt-1">Loading saved addresses…</span>
              ) : savedAddresses.length > 0 ? (
                <span className="d-block mt-1">{savedAddresses.length} saved address{savedAddresses.length === 1 ? "" : "es"} in your account.</span>
              ) : null}
            </p>
            <ul className="list-unstyled website-checkout-page__address-list mb-3">
              {pickOptions.map((opt, idx) => (
                <li key={opt.key}>
                  <label
                    className={`website-checkout-page__address-option d-flex gap-2 align-items-start mb-2${
                      selectedPickIndex === idx ? " is-selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="session-address-pick"
                      className="mt-1"
                      checked={selectedPickIndex === idx}
                      onChange={() => setSelectedPickIndex(idx)}
                    />
                    <span className="small">
                      <strong>{opt.label}</strong>
                      <br />
                      {opt.address.addressLine1}
                      {opt.address.landmark ? (
                        <>
                          <br />
                          <span className="text-muted">Near {opt.address.landmark}</span>
                        </>
                      ) : null}
                      <br />
                      {opt.address.city}, {opt.address.district}, {opt.address.state} — {opt.address.pincode}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {formError ? (
              <p className="text-danger small mb-2" role="alert">
                {formError}
              </p>
            ) : null}
            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={saving}
                onClick={() => {
                  setSessionPickOpen(false);
                  setFormError("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-sm website-product-detail__btn-cart" disabled={saving} onClick={confirmSessionPick}>
                {saving ? "Please wait…" : "Continue to payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PublicSiteFooter />
    </div>
  );
}
