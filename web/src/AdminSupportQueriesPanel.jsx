import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config.js";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function AdminSupportQueriesPanel({ adminHeaders }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [edits, setEdits] = useState(() => ({}));
  const [savingId, setSavingId] = useState(null);
  /** After save: short confirmation (esp. when status = completed). */
  const [saveNotice, setSaveNotice] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/queries`, { headers: adminHeaders });
      const list = data?.data || [];
      setRows(list);
      const next = {};
      for (const r of list) {
        next[r.id] = {
          adminNote: r.adminNote ?? "",
          contacted: r.contacted || "not_contacted",
          status: r.status || "pending",
        };
      }
      setEdits(next);
    } catch (e) {
      setRows([]);
      setMessage(e.response?.data?.message || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  function setField(id, field, value) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveRow(id) {
    const e = edits[id];
    if (!e) return;
    setSavingId(id);
    setMessage("");
    const markCompleted = e.status === "completed";
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/queries/${id}`,
        {
          adminNote: e.adminNote,
          contacted: e.contacted,
          status: e.status,
        },
        { headers: adminHeaders }
      );
      if (markCompleted) {
        setSaveNotice({
          title: "Query status resolved",
          body: "This ticket is marked completed. The customer will see it as resolved in Raised queries.",
        });
      } else {
        setSaveNotice({
          title: "Saved",
          body: "Your updates were saved successfully.",
        });
      }
      await fetchRows();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="admin-description mb-0">Loading support queries…</p>;
  }

  return (
    <section className="customize-workspace over-bg-panel">
      <div className="over-bg-head">
        <h2 className="mb-1">Customer queries</h2>
        <p className="mb-0">Review raised queries, add an internal note, mark contacted, and set status.</p>
      </div>
      {message ? <p className="admin-description mt-2 mb-0">{message}</p> : null}
      <div className="table-responsive mt-3 admin-support-queries-wrap">
        <table className="table align-middle mb-0 business-categories-table admin-support-queries-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Email / mobile</th>
              <th>Topic</th>
              <th>Message</th>
              <th>Admin note</th>
              <th>Contacted</th>
              <th>Status</th>
              <th className="text-end">Save</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="text-muted py-4">
                  No queries yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const e = edits[r.id] || { adminNote: "", contacted: "not_contacted", status: "pending" };
                const hoverName = [
                  r.userAccountEmail ? `Account: ${r.userAccountEmail}` : null,
                  `Submitted: ${formatWhen(r.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join("\n");
                return (
                  <tr key={r.id}>
                    <td className="small text-muted">{r.id}</td>
                    <td className="small" title={hoverName}>
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="small">
                      <div>{r.email}</div>
                      <div className="text-muted">{r.mobile}</div>
                    </td>
                    <td className="small">{r.categoryLabel || r.category}</td>
                    <td className="small admin-support-queries__msg" title={r.message}>
                      {r.message && r.message.length > 80 ? `${r.message.slice(0, 80)}…` : r.message || "—"}
                    </td>
                    <td style={{ minWidth: "10rem" }}>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={e.adminNote}
                        onChange={(ev) => setField(r.id, "adminNote", ev.target.value)}
                        placeholder="Internal note…"
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={e.contacted}
                        onChange={(ev) => setField(r.id, "contacted", ev.target.value)}
                      >
                        <option value="not_contacted">Not contacted</option>
                        <option value="contacted">Contacted</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={e.status}
                        onChange={(ev) => setField(r.id, "status", ev.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm admin-submit-btn"
                        disabled={savingId === r.id}
                        onClick={() => saveRow(r.id)}
                      >
                        {savingId === r.id ? "…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {saveNotice ? (
        <div
          className="customer-query-modal-backdrop"
          role="presentation"
          onClick={() => setSaveNotice(null)}
        >
          <div
            className="customer-query-modal-dialog admin-support-save-notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-query-notice-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 id="admin-query-notice-title" className="customer-query-modal-title">
              {saveNotice.title}
            </h3>
            <p className="mb-3 mb-md-4">{saveNotice.body}</p>
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm admin-submit-btn"
                onClick={() => setSaveNotice(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
