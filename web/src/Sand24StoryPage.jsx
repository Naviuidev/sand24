import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

const STORY_HERO_IMAGE = "/assets/images/sand24-story-hero.png";
const FOUNDER_IMAGE = "/assets/images/sand24-founder-bhanu.png";
const STORY_INSPIRATION_IMAGE = "/assets/images/sand24-story-inspiration-dye-bath.png";
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
            <div className="website-story-founder__copy website-story-founder__copy--lead">
              <h2 id="sand24-story-founder-heading" className="website-story-founder__title">
                Hi, I’m Bhanu, the proud founder and creative force behind SAND24.
              </h2>
              <p className="website-story-founder__subtitle">Welcome to SAND24—where fashion feels like home.</p>
              <p className="website-story-founder__para">
                Bhanu is a fashion designer driven by a deep commitment to sustainability, craftsmanship, and innovation. A graduate of INIFD Hyderabad (Master’s, 2016), Bhanu’s journey in design has been shaped by a strong academic foundation combined with a passion for exploring nature-led practices.
              </p>
              <p className="website-story-founder__para mb-0">
                From 2016 to 2020, Bhanu dedicated extensive research to the art and science of natural colour extraction—reviving age-old dyeing techniques while reimagining them for contemporary fashion. This period of exploration laid the groundwork for a design philosophy rooted in environmental consciousness, authenticity, and mindful creation.
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
            <div className="website-story-founder__continuation">
              <p className="website-story-founder__para">
                This vision came to life with the launch of the brand <em>Sand24</em>—a label that celebrates the beauty of nature through textiles. Every piece reflects a harmonious blend of organic processes and modern aesthetics, where colors are carefully extracted from natural sources and transformed into wearable art. The brand stands for slow fashion, ethical practices, and a return to the roots of design.
              </p>
              <p className="website-story-founder__para mb-0">
                Bhanu’s work is not just about clothing—it is about storytelling through fabric, preserving traditional knowledge, and creating a meaningful connection between nature and design. With <em>Sand24</em>, Bhanu continues to push boundaries, offering collections that are timeless, sustainable, and deeply personal.
              </p>
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
                    src={STORY_INSPIRATION_IMAGE}
                    alt="Natural dye bath: fabric soaking in a deep indigo-purple vat with a wooden stirring spoon"
                    className="website-story-inspiration__img"
                    loading="lazy"
                    decoding="async"
                  />
                  
                </div>
              </div>
              <div className="website-story-inspiration__copy">
                <h2 id="sand24-story-inspiration-heading" className="website-story-inspiration__title">
                The Art of slow fashion
                </h2>
                <p className="website-story-inspiration__tagline">
                A Conscious Choice 
                
                </p>
                <p className="website-story-inspiration__para mb-0 my-4">
                Slow fashion is an approach to clothing that focuses on quality, sustainability, and ethical production, encouraging mindful buying and long-lasting wear.
                </p>
                <p className="website-story-inspiration__para mb-0 my-4">
                Slow fashion is about intention — choosing quality over quantity, and timeless design over passing trends. Each piece is thoughtfully created using sustainable materials and traditional techniques, supporting artisans and reducing environmental impact.                </p>
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
                  Healing by Nature
                </h2>
                <p className="website-story-elegance__tagline">
                 Healthy life cycle
                </p>
                <p className="website-story-elegance__para mb-0 my-4">
                Slow fashion focuses on natural fabrics, mindful production, and thoughtful design—making it better not just for the environment, but for your health too. By choosing breathable materials like handwoven cotton and khadi, it reduces skin irritation and allows your body to stay cool and comfortable.
                </p>
                <p className="website-story-elegance__para my-4">
                Free from harsh chemicals and synthetic dyes, slow fashion garments are safer for long-term wear. Each piece is crafted with care, supporting artisans while promoting a healthier lifestyle. When you choose slow fashion, you choose clothing that feels as good as it looks—inside and out.
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
