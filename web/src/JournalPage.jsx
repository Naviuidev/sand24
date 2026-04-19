import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";
import { API_BASE_URL } from "./config.js";

function formatJournalDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function coverUrl(postId) {
  return `${API_BASE_URL}/api/blog-posts/${postId}/cover`;
}

export default function JournalPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/blog-posts`);
        if (!cancelled) {
          setPosts(res.data?.data || []);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          setPosts([]);
          setError(e.response?.data?.message || "Could not load journal posts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = posts.length > 0 ? posts[0] : null;
  const older = posts.length > 1 ? posts.slice(1) : [];

  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-journal-main website-journal-main--listing">
        <div className="website-journal-page">
          <div className="website-journal-page__frame">
            <header className="website-journal-page__header">
              <h1 className="website-journal-page__title">Sand 24 Journal</h1>
            </header>

            {loading ? (
              <p className="website-journal-page__status">Loading…</p>
            ) : error ? (
              <p className="website-journal-page__status website-journal-page__status--error" role="alert">
                {error}
              </p>
            ) : !latest ? (
              <p className="website-journal-page__status">
                No published stories yet. Check back soon.
              </p>
            ) : (
              <>
                <article className="website-journal-hero">
                  <Link
                    to={`/journal/${latest.slug}`}
                    className="website-journal-hero__link"
                    aria-label={`Read: ${latest.title}`}
                  >
                    <div className="website-journal-hero__media">
                      <img
                        src={coverUrl(latest.id)}
                        alt=""
                        className="website-journal-hero__img"
                        onError={(e) => {
                          e.currentTarget.classList.add("website-journal-hero__img--hidden");
                        }}
                      />
                    </div>
                    <h2 className="website-journal-hero__heading">{latest.title}</h2>
                    {latest.createdAt ? (
                      <p className="website-journal-hero__date">{formatJournalDate(latest.createdAt)}</p>
                    ) : null}
                    {latest.listingSummary ? (
                      <p className="website-journal-hero__excerpt">{latest.listingSummary}</p>
                    ) : null}
                  </Link>
                </article>

                {older.length > 0 ? (
                  <section className="website-journal-archive" aria-label="Previous journal posts">
                    <div className="row g-4 g-lg-5">
                      {older.map((p) => (
                        <div key={p.id} className="col-12 col-md-6">
                          <article className="website-journal-card">
                            <Link
                              to={`/journal/${p.slug}`}
                              className="website-journal-card__link"
                              aria-label={`Read: ${p.title}`}
                            >
                              <div className="website-journal-card__media">
                                <img
                                  src={coverUrl(p.id)}
                                  alt=""
                                  className="website-journal-card__img"
                                  onError={(e) => {
                                    e.currentTarget.classList.add("website-journal-card__img--hidden");
                                  }}
                                />
                              </div>
                              <h3 className="website-journal-card__title">{p.title}</h3>
                              {p.createdAt ? (
                                <p className="website-journal-card__date">{formatJournalDate(p.createdAt)}</p>
                              ) : null}
                              {p.listingSummary ? (
                                <p className="website-journal-card__excerpt">{p.listingSummary}</p>
                              ) : null}
                            </Link>
                          </article>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
