import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import AdminBusinessSidebar from "./AdminBusinessSidebar.jsx";
import { API_BASE_URL } from "./config.js";

function adminHeaders() {
  const k = import.meta.env.VITE_ADMIN_API_KEY;
  return k ? { "X-Admin-Key": k } : {};
}

function newBlock(type) {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const base = { id, type, colSpan: 12 };
  if (type === "heading") return { ...base, heading: "" };
  if (type === "paragraph") return { ...base, paragraph: "" };
  if (type === "heading_paragraph") return { ...base, heading: "", paragraph: "" };
  return { ...base, imageFile: null };
}

function SuccessModal({ title, message, onClose }) {
  if (!message) return null;
  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="admin-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-modal-title">{title}</h3>
        <p className="admin-modal-body mb-0">{message}</p>
        <div className="admin-modal-actions">
          <button type="button" className="btn admin-submit-btn" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogPage() {
  const [activeSection, setActiveSection] = useState("list");

  const [posts, setPosts] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [title, setTitle] = useState("");
  const [bannerHeadline, setBannerHeadline] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonHref, setButtonHref] = useState("");
  const [listingSummary, setListingSummary] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [saving, setSaving] = useState(false);

  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const closeModal = () => {
    setModalMessage("");
    setModalTitle("");
  };

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/blog-posts`, { headers: adminHeaders() });
      setPosts(res.data?.data || []);
    } catch (e) {
      setPosts([]);
      setListError(e.response?.data?.message || "Could not load blog posts.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "list") fetchList();
  }, [activeSection, fetchList]);

  const addBlock = (type) => {
    setBlocks((prev) => [...prev, newBlock(type)]);
  };

  const updateBlock = (id, patch) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const moveBlock = (id, dir) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const resetCreateForm = () => {
    setTitle("");
    setBannerHeadline("");
    setBannerSubtitle("");
    setButtonLabel("");
    setButtonHref("");
    setListingSummary("");
    setCoverFile(null);
    setBlocks([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setModalTitle("Missing title");
      setModalMessage("Please enter a blog title.");
      return;
    }
    const payloadBlocks = [];
    const imageFiles = [];
    for (const b of blocks) {
      if (b.type === "heading") {
        payloadBlocks.push({ type: "heading", colSpan: b.colSpan, heading: b.heading || "" });
      } else if (b.type === "paragraph") {
        payloadBlocks.push({ type: "paragraph", colSpan: b.colSpan, paragraph: b.paragraph || "" });
      } else if (b.type === "heading_paragraph") {
        payloadBlocks.push({
          type: "heading_paragraph",
          colSpan: b.colSpan,
          heading: b.heading || "",
          paragraph: b.paragraph || "",
        });
      } else if (b.type === "image") {
        if (!b.imageFile) {
          setModalTitle("Image required");
          setModalMessage("Each image block needs a file selected.");
          return;
        }
        payloadBlocks.push({ type: "image", colSpan: b.colSpan });
        imageFiles.push(b.imageFile);
      }
    }

    const payload = {
      title: title.trim(),
      bannerHeadline: bannerHeadline.trim(),
      bannerSubtitle: bannerSubtitle.trim(),
      buttonLabel: buttonLabel.trim(),
      buttonHref: buttonHref.trim(),
      listingSummary: listingSummary.trim(),
      blocks: payloadBlocks,
    };

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (coverFile) fd.append("cover", coverFile);
    imageFiles.forEach((f) => fd.append("blockImages", f));

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/blog-posts`, fd, {
        headers: adminHeaders(),
      });
      setModalTitle("Saved");
      setModalMessage(res.data?.message || "Blog has been posted.");
      resetCreateForm();
      setActiveSection("list");
      fetchList();
    } catch (err) {
      setModalTitle("Error");
      setModalMessage(err.response?.data?.message || "Could not save blog.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (row, next) => {
    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/admin/blog-posts/${row.id}/published`,
        { isPublished: next },
        { headers: adminHeaders() }
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, isPublished: next } : p))
      );
      if (res.data?.data?.publishedNow) {
        setModalTitle("Published");
        setModalMessage("Blog has been published to the site.");
      }
    } catch (err) {
      setModalTitle("Error");
      setModalMessage(err.response?.data?.message || "Could not update publish state.");
    }
  };

  const deletePost = async (row) => {
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/blog-posts/${row.id}`, { headers: adminHeaders() });
      fetchList();
    } catch (err) {
      setModalTitle("Error");
      setModalMessage(err.response?.data?.message || "Could not delete.");
    }
  };

  const displayHeroTitle = bannerHeadline.trim() || title.trim() || "Blog title";
  const displayHeroSub =
    bannerSubtitle.trim() ||
    listingSummary.trim() ||
    "Hero subtitle appears here when you fill Banner subtitle or Listing summary.";

  return (
    <main className="admin-login-page">
      <SuccessModal title={modalTitle} message={modalMessage} onClose={closeModal} />

      <div className="container-fluid py-4">
        <section className="customize-dashboard">
          <AdminBusinessSidebar activeItem="blog" />

          <section className="customize-main">
            <h1 className="mb-2">Sand 24 Journal</h1>
            <p className="admin-subtitle mb-4">
              Create posts, preview layout, then publish to the live site from the list.
            </p>

            <div className="admin-blog-subtabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`customize-nav-item rounded-pill ${activeSection === "list" ? "active" : ""}`}
                aria-selected={activeSection === "list"}
                onClick={() => setActiveSection("list")}
              >
                Created blogs
              </button>
              <button
                type="button"
                role="tab"
                className={`customize-nav-item rounded-pill ${activeSection === "create" ? "active" : ""}`}
                aria-selected={activeSection === "create"}
                onClick={() => setActiveSection("create")}
              >
                Create blog
              </button>
            </div>

            {activeSection === "list" && (
              <section className="customize-workspace over-bg-panel">
                <h2 className="h5 mb-3">Created blogs</h2>
                {listLoading ? (
                  <p className="admin-description mb-0">Loading…</p>
                ) : listError ? (
                  <p className="text-danger mb-0" role="alert">
                    {listError}
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th scope="col" style={{ width: "3rem" }}>
                            S.No
                          </th>
                          <th scope="col">Title</th>
                          <th scope="col" style={{ width: "11rem" }}>
                            Created
                          </th>
                          <th scope="col" style={{ width: "8rem" }}>
                            Live site
                          </th>
                          <th scope="col" style={{ width: "4rem" }}>
                            {" "}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-muted">
                              No blogs yet. Use Create blog to add one.
                            </td>
                          </tr>
                        ) : (
                          posts.map((row, idx) => (
                            <tr key={row.id}>
                              <td>{idx + 1}</td>
                              <td>{row.title}</td>
                              <td>
                                {row.createdAt
                                  ? new Date(row.createdAt).toLocaleString(undefined, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                              </td>
                              <td>
                                <div className="form-check form-switch mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`pub-${row.id}`}
                                    checked={row.isPublished}
                                    onChange={(e) => togglePublished(row, e.target.checked)}
                                    aria-label="Publish to live site"
                                  />
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm text-danger p-0"
                                  onClick={() => deletePost(row)}
                                  aria-label="Delete blog"
                                  title="Delete"
                                >
                                  🗑
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeSection === "create" && (
              <form onSubmit={handleSubmit} className="admin-blog-create">
                <div className="row g-4 admin-blog-create__grid">
                  <div className="col-12 col-xl-6">
                    <section className="customize-workspace over-bg-panel mb-3">
                      <h2 className="h6 mb-3">Banner (hero) — optional</h2>
                      <div className="mb-2">
                        <label className="form-label small mb-1" htmlFor="blog-banner-headline">
                          Banner headline
                        </label>
                        <input
                          id="blog-banner-headline"
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Banner headline (defaults to title if empty)"
                          value={bannerHeadline}
                          onChange={(e) => setBannerHeadline(e.target.value)}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1" htmlFor="blog-banner-sub">
                          Banner subtitle
                        </label>
                        <textarea
                          id="blog-banner-sub"
                          className="form-control form-control-sm"
                          rows={2}
                          value={bannerSubtitle}
                          onChange={(e) => setBannerSubtitle(e.target.value)}
                        />
                      </div>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <label className="form-label small mb-1" htmlFor="blog-btn-label">
                            Button label
                          </label>
                          <input
                            id="blog-btn-label"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Optional"
                            value={buttonLabel}
                            onChange={(e) => setButtonLabel(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small mb-1" htmlFor="blog-btn-href">
                            Button link (URL or path)
                          </label>
                          <input
                            id="blog-btn-href"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="/products"
                            value={buttonHref}
                            onChange={(e) => setButtonHref(e.target.value)}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="customize-workspace over-bg-panel mb-3">
                      <h2 className="h6 mb-2">Blog title (required)</h2>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title shown on the journal and in SEO"
                      />
                    </section>

                    <section className="customize-workspace over-bg-panel mb-3">
                      <h2 className="h6 mb-2">Cover image — optional</h2>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control form-control-sm"
                        onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      />
                    </section>

                    <section className="customize-workspace over-bg-panel mb-3">
                      <h2 className="h6 mb-2">Listing summary — optional</h2>
                      <textarea
                        className="form-control form-control-sm"
                        rows={3}
                        placeholder="Short text for blog cards / search. If empty, text is taken from your blocks."
                        value={listingSummary}
                        onChange={(e) => setListingSummary(e.target.value)}
                      />
                    </section>

                    <section className="customize-workspace over-bg-panel mb-3">
                      <h2 className="h6 mb-2">Article blocks</h2>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => addBlock("heading")}
                        >
                          + Heading
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => addBlock("paragraph")}
                        >
                          + Paragraph
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => addBlock("heading_paragraph")}
                        >
                          + Heading + paragraph
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => addBlock("image")}
                        >
                          + Image
                        </button>
                      </div>
                      <p className="small text-muted mb-3">
                        On desktop, blocks sit in a 12-column grid. Choose how many columns (of 12)
                        each block uses — e.g. 6 = half width.
                      </p>
                      {blocks.map((b) => (
                        <div
                          key={b.id}
                          className="border rounded p-2 mb-2 bg-white bg-opacity-50"
                        >
                          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                            <span className="small fw-bold text-uppercase text-muted">
                              {b.type.replace("_", " ")}
                            </span>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <label className="small mb-0">
                                Cols (of 12){" "}
                                <select
                                  className="form-select form-select-sm d-inline-block"
                                  style={{ width: "5rem" }}
                                  value={b.colSpan}
                                  onChange={(e) =>
                                    updateBlock(b.id, { colSpan: Number(e.target.value) })
                                  }
                                >
                                  {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="btn btn-sm btn-light border"
                                onClick={() => moveBlock(b.id, -1)}
                                aria-label="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-light border"
                                onClick={() => moveBlock(b.id, 1)}
                                aria-label="Move down"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => removeBlock(b.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          {b.type === "heading" && (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Heading"
                              value={b.heading}
                              onChange={(e) => updateBlock(b.id, { heading: e.target.value })}
                            />
                          )}
                          {b.type === "paragraph" && (
                            <textarea
                              className="form-control form-control-sm"
                              rows={3}
                              placeholder="Paragraph…"
                              value={b.paragraph}
                              onChange={(e) => updateBlock(b.id, { paragraph: e.target.value })}
                            />
                          )}
                          {b.type === "heading_paragraph" && (
                            <>
                              <input
                                type="text"
                                className="form-control form-control-sm mb-2"
                                placeholder="Heading"
                                value={b.heading}
                                onChange={(e) => updateBlock(b.id, { heading: e.target.value })}
                              />
                              <textarea
                                className="form-control form-control-sm"
                                rows={3}
                                placeholder="Paragraph…"
                                value={b.paragraph}
                                onChange={(e) => updateBlock(b.id, { paragraph: e.target.value })}
                              />
                            </>
                          )}
                          {b.type === "image" && (
                            <input
                              type="file"
                              accept="image/*"
                              className="form-control form-control-sm"
                              onChange={(e) =>
                                updateBlock(b.id, { imageFile: e.target.files?.[0] || null })
                              }
                            />
                          )}
                        </div>
                      ))}
                    </section>

                    <button
                      type="submit"
                      className="btn admin-submit-btn"
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save blog"}
                    </button>
                  </div>

                  <div className="col-12 col-xl-6">
                    <div className="admin-blog-preview sticky-top" style={{ top: "1rem" }}>
                      <p className="small text-muted mb-2">Preview</p>
                      <div className="admin-blog-preview__frame border rounded overflow-hidden shadow-sm">
                        <div
                          className="text-white p-4"
                          style={{ background: "linear-gradient(135deg, #1a2740 0%, #2d3a55 100%)" }}
                        >
                          <h3 className="h4 mb-2">{displayHeroTitle}</h3>
                          <p className="small mb-2 opacity-90">{displayHeroSub}</p>
                          {buttonLabel.trim() ? (
                            <span className="btn btn-sm btn-light">{buttonLabel}</span>
                          ) : null}
                        </div>
                        <div className="p-3 bg-white">
                          <div className="row g-2">
                            {blocks.length === 0 ? (
                              <p className="small text-muted mb-0">Add blocks to see them here.</p>
                            ) : (
                              blocks.map((b) => (
                                <div
                                  key={b.id}
                                  className={`col-12 col-lg-${Math.min(12, Math.max(1, Number(b.colSpan) || 12))}`}
                                >
                                  {b.type === "heading" && (
                                    <h4 className="h6 mb-1">{b.heading || "Heading"}</h4>
                                  )}
                                  {b.type === "paragraph" && (
                                    <p className="small mb-2">{b.paragraph || "Paragraph…"}</p>
                                  )}
                                  {b.type === "heading_paragraph" && (
                                    <>
                                      <h4 className="h6 mb-1">{b.heading || "Heading"}</h4>
                                      <p className="small mb-2">{b.paragraph || "Paragraph…"}</p>
                                    </>
                                  )}
                                  {b.type === "image" && b.imageFile && (
                                    <img
                                      src={URL.createObjectURL(b.imageFile)}
                                      alt=""
                                      className="img-fluid rounded mb-2"
                                      style={{ maxHeight: "200px", objectFit: "cover", width: "100%" }}
                                    />
                                  )}
                                  {b.type === "image" && !b.imageFile && (
                                    <div className="small text-muted border rounded p-2 mb-2">
                                      Image block — choose a file
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
