import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";

export default function JournalPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/blog-posts/by-slug/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          setPost(res.data?.data || null);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setPost(null);
          setError(e.response?.status === 404 ? "This story was not found." : "Could not load article.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const heroTitle = post?.bannerHeadline?.trim() || post?.title || "Journal";
  const heroSub = post?.bannerSubtitle?.trim() || post?.listingSummary || "";

  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-journal-main">
        {loading ? (
          <div className="container py-5 text-center website-journal-post__loading">Loading…</div>
        ) : error ? (
          <div className="container py-5 text-center website-journal-post__error">
            <p className="text-danger mb-3" role="alert">
              {error}
            </p>
            <Link to="/journal" className="website-journal-public-back">
              ← Back to Journal
            </Link>
          </div>
        ) : post ? (
          <>
            <section className="website-journal-post__hero" aria-label="Article header">
              <div className="website-journal-post__hero-shell">
                <h1 className="website-journal-post__hero-title">{heroTitle}</h1>
                {heroSub ? <p className="website-journal-post__hero-sub">{heroSub}</p> : null}
                {post.buttonLabel?.trim() && post.buttonHref?.trim() ? (
                  <p className="website-journal-post__hero-cta mb-0">
                    <a className="btn btn-outline-dark btn-sm rounded-pill" href={post.buttonHref}>
                      {post.buttonLabel}
                    </a>
                  </p>
                ) : null}
                {post.coverUrl ? (
                  <div className="website-journal-post__hero-cover">
                    <img
                      src={`${API_BASE_URL}${post.coverUrl}`}
                      alt=""
                      className="website-journal-post__hero-cover-img"
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <article className="container pb-5 website-journal-post__body" style={{ maxWidth: "960px" }}>
              <div className="row g-3">
                {(post.blocks || []).map((b) => (
                  <div
                    key={b.id}
                    className={`col-12 col-lg-${Math.min(12, Math.max(1, Number(b.colSpan) || 12))}`}
                  >
                    {b.type === "heading" && <h2 className="h4 mb-2">{b.heading}</h2>}
                    {b.type === "paragraph" && <p className="mb-3">{b.paragraph}</p>}
                    {b.type === "heading_paragraph" && (
                      <>
                        <h3 className="h5 mb-2">{b.heading}</h3>
                        <p className="mb-3">{b.paragraph}</p>
                      </>
                    )}
                    {b.type === "image" && b.imageUrl ? (
                      <img
                        src={`${API_BASE_URL}${b.imageUrl}`}
                        alt=""
                        className="img-fluid rounded w-100 mb-3"
                        style={{ objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-5 mb-0">
                <Link to="/journal" className="website-journal-public-back">
                  ← Back to Journal
                </Link>
              </p>
            </article>
          </>
        ) : null}
      </main>

      <PublicSiteFooter />
    </div>
  );
}
