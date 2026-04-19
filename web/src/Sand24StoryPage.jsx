import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

const STORY_HERO_IMAGE = "/assets/images/sand24-story-hero.png";
const FOUNDER_IMAGE = "/assets/images/sand24-founder-bhanu.png";
const MOUNTAIN_MEADOW_IMAGE = "/assets/images/sand24-story-mountain-meadow.png";
const ELEGANCE_FABRIC_IMAGE = "/assets/images/sand24-story-elegance-fabric.png";

export default function Sand24StoryPage() {
  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-story-main">
        <section className="website-story-intro" aria-labelledby="sand24-story-heading">
          <div className="container website-story-intro__inner">
            <h1 id="sand24-story-heading" className="website-story-intro__title">
              SAND 24 STORY
            </h1>
            <p className="website-story-intro__subtitle">We Make Cloths With A Green Heart</p>
          </div>
        </section>

        <section className="website-story-hero-image-section" aria-label="Sand 24 story">
          <div className="website-story-hero-image-frame">
            <img
              src={STORY_HERO_IMAGE}
              alt="Beach scene with natural textures, citrus, and relaxed essentials on sand"
              className="website-story-hero-image"
              loading="eager"
              decoding="async"
            />
          </div>
        </section>

        <section
          className="website-story-founder"
          aria-labelledby="sand24-story-founder-heading"
        >
          <div className="website-story-founder__grid">
            <div className="website-story-founder__copy">
              <h2 id="sand24-story-founder-heading" className="website-story-founder__title">
                The Mountain Meadow Halter Neck
              </h2>
              <p className="website-story-founder__subtitle">Better for you</p>
              <p className="website-story-founder__para">
                Bhanu Kusuma Founder and Chief Creative &amp; Innovation Officer for Ananas Anam
                Ltd, is an ethical entrepreneur with a vision for a more sustainable future that
                connects people, environment and economy.
              </p>
              <p className="website-story-founder__para">
                Originally from Spain, Carmen&apos;s career has taken her around the world. With a
                background in leathergoods design and manufacturing she worked as an industry
                consultant, and was brought to the Philippines by the Design Centre Philippines in
                the 1990s, where the journey of Piñatex® began.
              </p>
              <p className="website-story-founder__para mb-0">
                Her perseverance in developing a natural, sustainable leather alternative saw her
                undertake a PhD at the Royal College of Art (U.K.), further developing Ananas Anam
                through the incubator program at InnovationRCA.
              </p>
            </div>
            <div className="website-story-founder__visual">
              <div className="website-story-founder__arch">
                <img
                  src={FOUNDER_IMAGE}
                  alt="Bhanu Kusuma, founder"
                  className="website-story-founder__portrait"
                  loading="lazy"
                  decoding="async"
                />
                <div className="website-story-founder__caption">
                  <span className="website-story-founder__caption-label">OUR FOUNDER</span>
                  <span className="website-story-founder__caption-name">BHANU KUSUMA</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="website-story-inspiration"
          aria-labelledby="sand24-story-inspiration-heading"
        >
          <div className="website-story-inspiration__inner">
            <div className="website-story-inspiration__grid">
              <div className="website-story-inspiration__visual">
                <div className="website-story-inspiration__frame">
                  <img
                    src={MOUNTAIN_MEADOW_IMAGE}
                    alt="Handspun handwoven fabrics: glue-resist dyeing and natural textures"
                    className="website-story-inspiration__img"
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="website-story-inspiration__overlay website-story-inspiration__overlay--top">
                    / The Inspiration
                  </p>
                  <p className="website-story-inspiration__overlay website-story-inspiration__overlay--bottom">
                    Glue-resist fabric dyeing
                  </p>
                </div>
              </div>
              <div className="website-story-inspiration__copy">
                <h2 id="sand24-story-inspiration-heading" className="website-story-inspiration__title">
                  The Mountain Meadow Halter Neck Handspun Handwoven
                </h2>
                <p className="website-story-inspiration__tagline">
                  Better for you Better for planet
                </p>
                <p className="website-story-inspiration__para mb-0">
                  The journey of Ananas Anam began while Carmen, a leathergoods expert, was
                  consulting on the Philippines leather export industry in the 1990s. Shocked at
                  the environmental impact of mass leather production and chemical tanning she
                  realised this could not continue, but knew that PVC alternatives were not the
                  solution. She was driven to research a sustainable alternative.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="website-story-elegance"
          aria-labelledby="sand24-story-elegance-heading"
        >
          <div className="website-story-elegance__inner">
            <div className="website-story-elegance__grid">
              <div className="website-story-elegance__copy">
                <h2 id="sand24-story-elegance-heading" className="website-story-elegance__title">
                  Elegance in Eco-Consciousness
                </h2>
                <p className="website-story-elegance__tagline">
                  Better for you
                  <br />
                  Better for planet
                </p>
                <p className="website-story-elegance__para mb-0">
                  Sand 24 designs are a harmonious fusion of style and sustainability. Our
                  collections are carefully curated to offer chic, timeless pieces that seamlessly
                  blend into any wardrobe. Whether it&apos;s a classic silk saree or a contemporary
                  cotton dress, our minimalistic yet elegant silhouettes are designed to transcend
                  trends, making them versatile choices for every occasion.
                </p>
              </div>
              <div className="website-story-elegance__visual">
                <div className="website-story-elegance__frame">
                  <img
                    src={ELEGANCE_FABRIC_IMAGE}
                    alt="Olive green hand-loomed fabric folded to show natural weave and texture"
                    className="website-story-elegance__img"
                    loading="lazy"
                    decoding="async"
                  />
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
