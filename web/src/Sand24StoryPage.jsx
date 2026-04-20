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
              Hi, I’m Bhanu, the proud founder and creative force behind SAND24.
              </h2>
              <p className="website-story-founder__subtitle">Welcome to SAND24—where fashion feels like home.</p>
             
              <p className="website-story-founder__para">
              With over 9 years of experience in Fashion Design, I’ve always been driven by a desire to create something meaningful—clothing that not only looks beautiful but feels like you.
              </p>
              <p className="website-story-founder__para mb-0">
              SAND24 was born from the idea of blending elegance with ease, where every piece is a reminder to slow down, breathe, and reconnect with yourself and with nature.
              </p>
              <p className="website-story-founder__para mb-0">
              I believe fashion should be more than just style—it should be a feeling, an expression of presence, calm, and individuality. That’s why each design at SAND24 reflects my love for craftsmanship, innovation, and wearable art.
              </p>
              <p className="website-story-founder__para mb-0">
              When I’m not immersed in fabric and form, you’ll find me sketching new ideas, experimenting with textures, or traveling in search of inspiration.
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
