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

export default function AdminContactPanel({ adminHeaders, onSaveSuccess }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [edits, setEdits] = useState(() => ({}));
  const [savingId, setSavingId] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/admin/contacts`, { headers: adminHeaders });
      const list = data?.data || [];
      setRows(list);
      const next = {};
      for (const r of list) {
        next[r.id] = {
          adminNote: r.adminNote ?? "",
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
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/contacts/${id}`,
        {
          adminNote: e.adminNote,
          status: e.status,
        },
        { headers: adminHeaders }
      );
      await fetchRows();
      onSaveSuccess?.();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="admin-description mb-0">Loading contact form messages…</p>;
  }

  return (
    <section className="customize-workspace over-bg-panel">
      <div className="over-bg-head">
        <h2 className="mb-1">Contact form</h2>
        <p className="mb-0">
          Messages from the public &quot;Get in Touch&quot; page. Add an internal note and set status when
          handled.
        </p>
      </div>
      {message ? <p className="admin-description mt-2 mb-0">{message}</p> : null}
      <div className="table-responsive mt-3 admin-support-queries-wrap">
        <table className="table align-middle mb-0 business-categories-table admin-support-queries-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Message</th>
              <th>Submitted</th>
              <th>Admin note</th>
              <th>Status</th>
              <th className="text-end">Save</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="text-muted py-4">
                  No messages yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const e = edits[r.id] || { adminNote: "", status: "pending" };
                return (
                  <tr key={r.id}>
                    <td className="small text-muted">{r.id}</td>
                    <td className="small">{r.fullName}</td>
                    <td className="small">
                      <a href={`mailto:${encodeURIComponent(r.email)}`}>{r.email}</a>
                    </td>
                    <td className="small admin-support-queries__msg" title={r.message}>
                      {r.message && r.message.length > 100 ? `${r.message.slice(0, 100)}…` : r.message || "—"}
                    </td>
                    <td className="small text-muted">{formatWhen(r.createdAt)}</td>
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
    </section>
  );
}
