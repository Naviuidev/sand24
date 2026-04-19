import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";
import { formatRupeeInr, productImageSrc } from "./productUtils.js";

function parseLines(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return [];
}

function statusLabel(status) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PENDING_PAYMENT":
      return "Pending payment";
    case "FAILED":
      return "Failed";
    case "PENDING":
      return "Pending";
    default:
      return status || "—";
  }
}

/** Per-line fulfilment from API (aligned with `lines` indices). */
function normalizeLineFulfillment(raw, lineCount) {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: lineCount }, (_, i) => ({
    shippedAt: arr[i]?.shippedAt ?? null,
    deliveredAt: arr[i]?.deliveredAt ?? null,
  }));
}

/**
 * Three-step tracker: Ordered (paid) → Shipped → Delivered.
 * Uses per-line admin fulfilment so mixed states (some lines shipped/delivered, some not) show as partial fills + hints.
 */
function OrderDeliveryStepper({ lines, lineFulfillment }) {
  const n = lines.length;
  if (n === 0) return null;

  const lf = normalizeLineFulfillment(lineFulfillment, n);
  const shippedCount = lf.filter((x) => x.shippedAt != null).length;
  const deliveredCount = lf.filter((x) => x.deliveredAt != null).length;

  const allShipped = shippedCount === n;
  const allDelivered = deliveredCount === n;

  const shipFillPct = Math.round((100 * shippedCount) / n);
  const deliveredFillPct = Math.round((100 * deliveredCount) / n);

  function dotClass(i) {
    const base = "order-delivery-stepper__dot";
    if (i === 0) {
      return `${base} order-delivery-stepper__dot--done`;
    }
    if (i === 1) {
      if (allShipped) return `${base} order-delivery-stepper__dot--done`;
      if (shippedCount > 0) return `${base} order-delivery-stepper__dot--partial`;
      return `${base} order-delivery-stepper__dot--current`;
    }
    if (i === 2) {
      if (allDelivered) return `${base} order-delivery-stepper__dot--done`;
      if (deliveredCount > 0) return `${base} order-delivery-stepper__dot--partial`;
      if (allShipped) return `${base} order-delivery-stepper__dot--current`;
      return `${base} order-delivery-stepper__dot--todo`;
    }
    return base;
  }

  let statusText = "";
  let statusTone = "pending";
  if (allDelivered) {
    statusText = "Delivered";
    statusTone = "done";
  } else if (shippedCount === 0) {
    statusText = "Not yet shipped";
    statusTone = "pending";
  } else if (!allShipped) {
    statusText = `Shipping in progress (${shippedCount} of ${n} items)`;
    statusTone = "progress";
  } else if (deliveredCount === 0) {
    statusText = "Shipped — on the way";
    statusTone = "shipped";
  } else {
    statusText = `Delivery in progress (${deliveredCount} of ${n} items)`;
    statusTone = "progress";
  }

  return (
    <div
      className="order-delivery-stepper mb-2"
      role="group"
      aria-label="Delivery progress"
    >
      <p className={`order-delivery-stepper__status order-delivery-stepper__status--${statusTone} mb-2`}>
        {statusText}
      </p>
      <div className="order-delivery-stepper__track">
        <span className={`${dotClass(0)} order-delivery-stepper__dot-pos order-delivery-stepper__dot-pos--0`} />
        <span
          className="order-delivery-stepper__segment order-delivery-stepper__line-pos--0"
          title={`Packed / shipped: ${shippedCount} of ${n}`}
          aria-hidden
        >
          <span className="order-delivery-stepper__segment-track" />
          <span className="order-delivery-stepper__segment-fill" style={{ width: `${shipFillPct}%` }} />
        </span>
        <span className={`${dotClass(1)} order-delivery-stepper__dot-pos order-delivery-stepper__dot-pos--1`} />
        <span
          className="order-delivery-stepper__segment order-delivery-stepper__line-pos--1"
          title={`Delivered: ${deliveredCount} of ${n}`}
          aria-hidden
        >
          <span className="order-delivery-stepper__segment-track" />
          <span className="order-delivery-stepper__segment-fill" style={{ width: `${deliveredFillPct}%` }} />
        </span>
        <span className={`${dotClass(2)} order-delivery-stepper__dot-pos order-delivery-stepper__dot-pos--2`} />
        <span className="order-delivery-stepper__label order-delivery-stepper__label-pos--0">Ordered</span>
        <span className="order-delivery-stepper__label order-delivery-stepper__label-pos--1">Shipped</span>
        <span className="order-delivery-stepper__label order-delivery-stepper__label-pos--2">Delivered</span>
      </div>
    </div>
  );
}

export default function ProfileOrdersPanel() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/me/orders`);
        if (!cancelled) {
          setOrders(data?.data || []);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e.response?.data?.message || "Could not load orders.");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || !user) {
    return <p className="text-center text-muted mb-0">Loading…</p>;
  }

  if (loading) {
    return <p className="text-center text-muted mb-0">Loading orders…</p>;
  }

  return (
    <div className="customer-profile-orders">
      <h2 className="customer-profile-section__title mb-3">Orders</h2>
      {loadError ? (
        <p className="text-danger" role="alert">
          {loadError}
        </p>
      ) : null}
      {orders.length === 0 && !loadError ? (
        <p className="text-muted mb-0 text-center">
          No orders yet.{" "}
          <Link to="/products" className="website-wishlist-page__link">
            Shop the collection
          </Link>
        </p>
      ) : (
        <div className="customer-profile-orders__list d-flex flex-column gap-4">
          {orders.map((order) => {
            const lines = parseLines(order.lines);
            const totalRupee =
              typeof order.amountInr === "number"
                ? order.amountInr
                : typeof order.amountPaise === "number"
                  ? order.amountPaise / 100
                  : 0;
                const created = order.createdAt
              ? new Date(order.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—";

            return (
              <section key={order.id} className="customer-profile-order-card border rounded-3 p-3 p-md-4 bg-white">
                <div className="d-flex flex-wrap justify-content-between gap-2 align-items-baseline mb-3">
                  <div>
                    <span className="fw-semibold">Order #{order.id}</span>
                    <span className="text-muted small ms-2">{created}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span
                      className={`badge rounded-pill customer-profile-order-card__status customer-profile-order-card__status--${String(order.status || "unknown")
                        .toLowerCase()
                        .replace(/_/g, "-")}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <span className="small text-muted text-break" title={order.merchantOrderId}>
                      {order.merchantOrderId}
                    </span>
                  </div>
                </div>
                {order.status === "PAID" && lines.length > 0 ? (
                  <OrderDeliveryStepper lines={lines} lineFulfillment={order.lineFulfillment} />
                ) : null}
                <p className="small mb-3">
                  <strong>Total:</strong> {formatRupeeInr(totalRupee)}
                </p>

                {lines.length === 0 ? (
                  <p className="small text-muted mb-0">No line items stored for this order.</p>
                ) : (
                  <div className="table-responsive customer-profile-order-table-wrap">
                    <table className="table table-sm table-bordered align-middle mb-0 customer-profile-order-table">
                      <thead className="table-light">
                        <tr>
                          <th scope="col" className="customer-profile-order-table__col-product">
                            Product
                          </th>
                          <th scope="col">Size</th>
                          <th scope="col" className="text-end">
                            Qty
                          </th>
                          <th scope="col" className="text-end">
                            Unit
                          </th>
                          <th scope="col" className="text-end">
                            Line total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, idx) => (
                          <tr key={`${order.id}-${line.productId}-${idx}`}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                {line.productId ? (
                                  <Link to={`/products/${line.productId}`} className="customer-profile-order-table__thumb-link">
                                    <img
                                      src={productImageSrc(line.productId, 1)}
                                      alt=""
                                      className="customer-profile-order-table__thumb rounded"
                                      width={40}
                                      height={50}
                                    />
                                  </Link>
                                ) : null}
                                <span className="small">{line.title || "—"}</span>
                              </div>
                            </td>
                            <td className="small">{line.sizeLabel || "—"}</td>
                            <td className="text-end small">{line.quantity ?? "—"}</td>
                            <td className="text-end small">{formatRupeeInr(line.unitPrice ?? 0)}</td>
                            <td className="text-end small fw-medium">{formatRupeeInr(line.lineTotal ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
