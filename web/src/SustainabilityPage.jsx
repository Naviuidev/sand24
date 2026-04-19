import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function SustainabilityPage() {
  return (
    <div className="website-home-page">
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
                We are glad to partner with Assam State Rural Livelihood Mission (ASRLM) for booting our
                sustainability initiatives. ASRLM is a mission by the state Government of Assam (INDIA).
              </h2>
              <p className="website-sustainability-hero__body">
                Through the empowerment of rural women Self Help Groups (SHGs). ASRLM aims to improve the
                economic status and quality of life of rural communities by promoting sustainable
                livelihoods. This includes activities like skill development, capacity building, and
                providing access to resources and markets for socio-economic growth.
              </p>
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
          aria-labelledby="sustainability-planet-heading"
        >
          <div className="container">
            <div className="row align-items-center g-4 g-lg-5">
              <div className="col-12 col-lg-6">
                <h2 id="sustainability-planet-heading" className="website-sustainability-planet__title">
                  Planet - Reduced Carbon Footprint
                </h2>
                <p className="website-sustainability-planet__body">
                  At Sand 24, we champion handloom manufacturing for its eco-conscious benefits. Studies show
                  that handloom production consumes significantly less energy, with a 2018 report by the Indian
                  Ministry of Textiles indicating a 50% reduction in carbon emissions compared to mechanized
                  processes.
                </p>
              </div>
              <div className="col-12 col-lg-6">
                <div className="website-sustainability-planet__visual">
                  <img
                    src="/sustainability-planet-vanam.png"
                    alt="Vanam outfit: handloom details and craft annotations"
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
                      src="/sustainability-product-handwoven.png"
                      alt="Hand-embroidered Sand 24 outfit in an artisan setting"
                      className="website-sustainability-product__photo"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <h2 id="sustainability-product-heading" className="website-sustainability-product__title">
                  Product - Sustainably Handwoven
                </h2>
                <p className="website-sustainability-product__body">
                  Sand 24 products epitomize ethical and sustainable fashion. Our commitment extends from
                  sourcing materials ethically, supporting local artisans, to minimizing environmental impact
                  through eco-friendly practices. Join us in making a positive difference, one conscious choice
                  at a time.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
