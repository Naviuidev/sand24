import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

const SUSTAINABILITY_KHADI_PRODUCT_IMAGE = "/sustainability-product-khadi-weaving.png";
const SUSTAINABILITY_KHADI_PRODUCT_URL = "https://sand24.in/products/20";
const SUSTAINABILITY_BLOOM_MARIGOLD_IMAGE = "/sustainability-bloom-marigold-dress.png";

export default function SustainabilityPage() {
  return (
    <div className="website-home-page website-home-page--sustainability">
      <PublicSiteHeader />

      <main className="website-sustainability-main">
        <section
          className="website-sustainability-hero"
          aria-labelledby="sustainability-page-heading sustainability-subheading"
        >
          <div className="container">
            <div className="website-sustainability-hero__frame">
              <h1 id="sustainability-page-heading" className="website-sustainability-hero__title">
                Sustainability
              </h1>
              <h2 id="sustainability-subheading" className="website-sustainability-hero__subtitle">
                “Rooted in tradition and thoughtfully handcrafted in the heritage village of Pochampally, near
                Hyderabad, India—where every piece reflects timeless craftsmanship.”
              </h2>
            </div>
          </div>
        </section>

        <section
          className="website-sustainability-people"
          aria-labelledby="sustainability-people-heading"
        >
          <div className="container">
            <div className="row align-items-center g-4 g-lg-5">
              <div className="col-12 col-lg-6 order-lg-1">
                <div className="website-sustainability-people__visual">
                  <img
                    src="/sustainability-people-collage.png"
                    alt="Assamese women weavers and handloom craft"
                    className="website-sustainability-people__collage"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <div className="col-12 col-lg-6 order-lg-2">
                <h2 id="sustainability-people-heading" className="website-sustainability-people__title">
                  People -100% Ethically Sourced
                </h2>
                <p className="website-sustainability-people__body">
                  At Sand 24, sustainability is our essence. We exclusively source fabric from highly skilled
                  women weavers in Assam, renowned globally for their handloom and silk craftsmanship. Our
                  weavers wholly benefit from the sale of fabric produced, without the involvement of
                  middlemen.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="website-sustainability-planet"
          aria-labelledby="sustainability-bloom-marigold-heading"
        >
          <div className="container">
            <div className="row align-items-center g-4 g-lg-5">
              <div className="col-12 col-lg-6">
                <h2 id="sustainability-bloom-marigold-heading" className="website-sustainability-planet__title">
                  Bloom – Marigold Dyed Elegance
                </h2>
                <p className="website-sustainability-planet__body">
                  Dyed with natural marigold petals, this flowy dress carries warm, sun-kissed hues inspired by
                  nature. Its soft, airy silhouette drapes effortlessly, creating a sense of ease and movement
                  with every step.
                </p>
                <p className="website-sustainability-planet__body">
                  Delicate shell-detailed straps add a subtle handcrafted touch, blending earthy textures with a
                  hint of coastal charm. Light, graceful, and thoughtfully made — a piece designed for slow,
                  beautiful moments.
                </p>
              </div>
              <div className="col-12 col-lg-6">
                <div className="website-sustainability-planet__visual">
                  <img
                    src={SUSTAINABILITY_BLOOM_MARIGOLD_IMAGE}
                    alt="Marigold-dyed yellow floral dress in a garden setting, with detail callouts for shell straps, sleeveless comfort, hand-gathered pleats, and side pockets"
                    className="website-sustainability-planet__graphic"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="website-sustainability-product"
          aria-labelledby="sustainability-product-heading"
        >
          <div className="container">
            <div className="row align-items-center g-4 g-lg-5">
              <div className="col-12 col-lg-6">
                <div className="website-sustainability-product__visual">
                  <div className="website-sustainability-product__frame">
                    <img
                      src={SUSTAINABILITY_KHADI_PRODUCT_IMAGE}
                      alt="Woman in a pinstriped cream khadi dress at a handloom weaving workshop"
                      className="website-sustainability-product__photo"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <h2 id="sustainability-product-heading" className="website-sustainability-product__title">
                Product – Handwoven Khadi
                </h2>
                <p className="website-sustainability-product__body my-4">
                  Rooted in tradition, this piece is crafted from handspun khadi — a fabric that breathes with
                  simplicity and purpose. Each thread is woven with care, celebrating the artistry of skilled
                  artisans and the beauty of slow fashion.
                </p>
                <p className="website-sustainability-product__body my-4">
                  Light, airy, and naturally textured, khadi offers comfort while carrying a story of heritage
                  and mindful making. Designed to move with ease, this garment reflects timeless craftsmanship
                  and conscious living.
                </p>
                <div className="website-sustainability-product__actions">
                  <a href={SUSTAINABILITY_KHADI_PRODUCT_URL} className="website-featured-product__btn">
                    View Product
                    <span className="website-featured-product__btn-arrow" aria-hidden>
                      →
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
