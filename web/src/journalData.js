/**
 * Sand 24 Journal — sample post shapes for a future CMS/API (not wired to the empty Journal UI yet).
 */
export const JOURNAL_POSTS = [
  {
    slug: "natural-dyes-slow-fashion",
    title: "Natural dyes & slow fashion",
    excerpt:
      "How we choose colour that respects water, soil, and the hands that make the cloth — without rushing the rhythm of the craft.",
    date: "2026-03-18",
    readMinutes: 5,
    coverSrc: "/assets/images/pillars/craft.png",
    body: [
      "Colour at Sand 24 begins with restraint. We favour dyes that ask less of rivers and more of patience: repeated dips, gentle heat, and time for the fibre to take hold.",
      "Slow fashion is not a slogan here — it is the only way the work stays honest. When batch sizes stay small, mistakes are visible early and beauty has room to emerge.",
      "We share this journal to document that process: what we try, what we learn, and how nature keeps teaching us to do better.",
    ],
  },
  {
    slug: "threads-of-kala-cotton",
    title: "Threads of Kala cotton",
    excerpt:
      "Why we reach for rain-fed cotton from the Kutch region — and what it means for drape, breathability, and the farmers behind the fibre.",
    date: "2026-02-04",
    readMinutes: 7,
    coverSrc: "/assets/images/mountain-meadow/kala-dresses.png",
    body: [
      "Kala cotton is grown with far less irrigation than conventional cotton. That matters in a warming climate — and it shows in the hand of the fabric once it is spun and woven.",
      "Our design team works backwards from the yarn: we listen to what the cloth wants to become before we sketch a silhouette.",
      "Every season we deepen relationships with the same weaving clusters so quality can climb together instead of chasing the lowest bid.",
    ],
  },
  {
    slug: "studio-notes-hand-block-printing",
    title: "Studio notes: hand block printing",
    excerpt:
      "A peek inside the Sand 24 studio — registering a repeat, mixing the paste, and why no two metres are ever truly identical.",
    date: "2026-01-15",
    readMinutes: 4,
    coverSrc: "/assets/images/sustainability/hand-block-printing.png",
    body: [
      "Block printing rewards focus. The carver, the printer, and the dyer each leave a fingerprint in the final textile — variation is proof of life, not a defect.",
      "We photograph every strike before it leaves the table so we can trace a print back to its day and its team.",
      "When you wear a hand-blocked piece, you carry that chain of decisions with you — we think that is worth writing about.",
    ],
  },
];

export function getJournalPostBySlug(slug) {
  return JOURNAL_POSTS.find((p) => p.slug === slug) ?? null;
}

export function formatJournalDate(isoDate) {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
