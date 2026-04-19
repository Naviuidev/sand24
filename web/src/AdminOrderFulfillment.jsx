import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { formatRupeeInr } from "./productUtils.js";

function lineKey(orderId, lineIndex) {
  return `${orderId}-${lineIndex}`;
}

/**
 * Custom tooltip (portal + fixed): native `title` on table cells is unreliable and
 * `.table-responsive` overflow clips in-flow tooltips.
 */
function AdminCustomerNameCell({ row }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, maxWidth: 320 });
  const triggerRef = useRef(null);
  const leaveTimerRef = useRef(null);

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
    const onScroll = () => positionTip();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, positionTip]);

  const email = row.userEmail || "";
  const a = row.shippingAddress || {};
  const show = (v) => {
    const s = v != null ? String(v).trim() : "";
    return s || "—";
  };

  const tooltipEl =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="admin-fulfillment-tooltip admin-fulfillment-tooltip--portal"
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
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">Name</span> {show(row.userName)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">Email</span> {show(email)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">Address line</span> {show(a.addressLine1)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">Landmark</span> {show(a.landmark)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">State</span> {show(a.state)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">District</span> {show(a.district)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-1">
              <span className="admin-fulfillment-tooltip__k">City</span> {show(a.city)}
            </p>
            <p className="admin-fulfillment-tooltip__line mb-0">
              <span className="admin-fulfillment-tooltip__k">Postcode</span> {show(a.pincode)}
            </p>
          </div>,
          document.body
        )
      : null;

  return (
    <td className="admin-fulfillment-user-cell">
      <span
        ref={triggerRef}
        className="admin-fulfillment-user-cell__trigger"
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
      >
        <span className="admin-fulfillment-user-cell__name-text">{row.userName || "—"}</span>
      </span>
      {tooltipEl}
    </td>
  );
}

export default function AdminOrderFulfillment({ view, adminHeaders, onSuccessNotice }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingInputs, setPendingInputs] = useState(() => ({}));
  const [selectedDeliver, setSelectedDeliver] = useState(() => new Set());
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const fetchLines = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const stage =
        view === "pending" ? "pending" : view === "shipped" ? "shipped" : "delivered";
      const { data } = await axios.get(
        `${API_BASE_URL}/api/admin/orders/fulfillment-lines?stage=${encodeURIComponent(stage)}`,
        { headers: adminHeaders }
      );
      const list = data?.data || [];
      setRows(list);
      const next = {};
      for (const r of list) {
        const k = lineKey(r.orderId, r.lineIndex);
        next[k] = {
          trackingUrl: r.trackingUrl ?? "",
          trackingId: r.trackingId ?? "",
        };
      }
      setPendingInputs(next);
      setSelectedDeliver(new Set());
    } catch (e) {
      setRows([]);
      setMessage(e.response?.data?.message || e.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [adminHeaders, view]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  function setInput(orderId, lineIndex, field, value) {
    const k = lineKey(orderId, lineIndex);
    setPendingInputs((prev) => ({
      ...prev,
      [k]: { ...prev[k], [field]: value },
    }));
  }

  async function handleUpdateShipping(orderId, lineIndex) {
    const k = lineKey(orderId, lineIndex);
    const inp = pendingInputs[k] || { trackingUrl: "", trackingId: "" };
    setBusyKeys((s) => new Set(s).add(k));
    setMessage("");
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/orders/fulfillment/update-shipping`,
        {
          orderId,
          lineIndex,
          trackingUrl: inp.trackingUrl,
          trackingId: inp.trackingId,
        },
        { headers: adminHeaders }
      );
      if (onSuccessNotice) onSuccessNotice("Shipping updated.");
      else setMessage("Shipping updated.");
      await fetchLines();
    } catch (e) {
      setMessage(e.response?.data?.message || e.message || "Update failed.");
    } finally {
      setBusyKeys((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
    }
  }

  function toggleDeliver(orderId, lineIndex) {
    const k = lineKey(orderId, lineIndex);
    setSelectedDeliver((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  async function submitMarkDelivered() {
    if (selectedDeliver.size === 0) {
      setMessage("Select at least one order line.");
      return;
    }
    const items = [];
    for (const k of selectedDeliver) {
      const dash = k.lastIndexOf("-");
      if (dash <= 0) continue;
      items.push({
        orderId: Number(k.slice(0, dash)),
        lineIndex: Number(k.slice(dash + 1)),
      });
    }
    setBatchBusy(true);
    setMessage("");
    try {
      await axios.post(
        `${API_BASE_URL}/api/admin/orders/fulfillment/mark-delivered`,
        { items },
        { headers: adminHeaders }
      );
      if (onSuccessNotice) onSuccessNotice("Marked as delivered.");
      else setMessage("Marked as delivered.");
      await fetchLines();
    } catch (e) {
      setMessage(e.response?.data?.message || e.message || "Could not update.");
    } finally {
      setBatchBusy(false);
    }
  }

  const title =
    view === "pending"
      ? "Order details"
      : view === "shipped"
        ? "Shipped"
        : "Delivered";

  if (loading) {
    return (
      <section className="customize-workspace over-bg-panel">
        <p className="admin-description mb-0">Loading {title.toLowerCase()}…</p>
      </section>
    );
  }

  return (
    <section className="customize-workspace over-bg-panel admin-fulfillment-panel">
      <div className="over-bg-head d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h2 className="mb-1">{title}</h2>
          <p className="mb-0 text-muted small">
            {view === "pending" &&
              "Paid orders awaiting tracking. Hover the customer name for the full address."}
            {view === "shipped" &&
              "Out for delivery. Select lines and submit to record delivery."}
            {view === "delivered" && "Completed shipments with shipped and delivered dates."}
          </p>
        </div>
      </div>

      {message && <p className="admin-description mb-3">{message}</p>}

      <div className="table-responsive admin-fulfillment-table-wrap">
        {view === "pending" && (
          <table className="table align-middle mb-0 business-categories-table admin-fulfillment-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Price</th>
                <th>Ordered</th>
                <th>Tracking URL</th>
                <th>Tracking ID</th>
                <th>Order no.</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="text-muted py-4">
                    No paid orders waiting for shipping.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const k = lineKey(r.orderId, r.lineIndex);
                  const inp = pendingInputs[k] || { trackingUrl: "", trackingId: "" };
                  const busy = busyKeys.has(k);
                  return (
                    <tr key={k}>
                      <AdminCustomerNameCell row={r} />
                      <td>{r.productTitle}</td>
                      <td>{formatRupeeInr(r.linePrice)}</td>
                      <td className="text-nowrap">
                        {r.orderedAt
                          ? new Date(r.orderedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td style={{ minWidth: "140px" }}>
                        <input
                          type="url"
                          className="form-control form-control-sm"
                          placeholder="https://…"
                          value={inp.trackingUrl}
                          onChange={(e) =>
                            setInput(r.orderId, r.lineIndex, "trackingUrl", e.target.value)
                          }
                        />
                      </td>
                      <td style={{ minWidth: "120px" }}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Tracking id"
                          value={inp.trackingId}
                          onChange={(e) =>
                            setInput(r.orderId, r.lineIndex, "trackingId", e.target.value)
                          }
                        />
                      </td>
                      <td className="text-break small">{r.merchantOrderId}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm admin-submit-btn"
                          disabled={busy}
                          onClick={() => handleUpdateShipping(r.orderId, r.lineIndex)}
                        >
                          {busy ? "…" : "Update shipping"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {view === "shipped" && (
          <>
            <table className="table align-middle mb-0 business-categories-table admin-fulfillment-table">
              <thead>
                <tr>
                  <th scope="col" className="admin-fulfillment-checkbox-col">
                    <span className="visually-hidden">Select</span>
                  </th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Tracking URL</th>
                  <th>Tracking ID</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="text-muted py-4">
                      No shipped orders pending delivery confirmation.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const k = lineKey(r.orderId, r.lineIndex);
                    return (
                      <tr key={k}>
                        <td>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedDeliver.has(k)}
                            onChange={() => toggleDeliver(r.orderId, r.lineIndex)}
                            aria-label={`Select ${r.productTitle}`}
                          />
                        </td>
                        <AdminCustomerNameCell row={r} />
                        <td>{r.productTitle}</td>
                        <td>{formatRupeeInr(r.linePrice)}</td>
                        <td className="small text-break">
                          {r.trackingUrl ? (
                            <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer">
                              {r.trackingUrl}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="small">{r.trackingId || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {rows.length > 0 && (
              <div className="mt-3 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn admin-submit-btn"
                  disabled={batchBusy || selectedDeliver.size === 0}
                  onClick={submitMarkDelivered}
                >
                  {batchBusy ? "Submitting…" : "Submit delivered"}
                </button>
              </div>
            )}
          </>
        )}

        {view === "delivered" && (
          <table className="table align-middle mb-0 business-categories-table admin-fulfillment-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Shipped</th>
                <th>Delivered</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={4} className="text-muted py-4">
                    No delivered line items yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const k = lineKey(r.orderId, r.lineIndex);
                  return (
                    <tr key={k}>
                      <AdminCustomerNameCell row={r} />
                      <td>{r.productTitle}</td>
                      <td className="text-nowrap small">
                        {r.shippedAt
                          ? new Date(r.shippedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="text-nowrap small">
                        {r.deliveredAt
                          ? new Date(r.deliveredAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
