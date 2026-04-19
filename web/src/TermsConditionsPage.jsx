import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function TermsConditionsPage() {
  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-policy-main">
        <section className="website-policy-hero" aria-labelledby="terms-conditions-heading">
          <div className="container">
            <h1 id="terms-conditions-heading" className="website-policy-hero__title">
              Terms &amp; Conditions
            </h1>
          </div>
        </section>

        <section className="website-policy-content" aria-label="Terms and conditions">
          <div className="container">
            <div className="website-policy-prose">
              <p className="website-policy-prose__para">
                By accessing and using our website or mobile application, you agree to comply with and be
                bound by these Terms &amp; Conditions. All products and services provided are subject to
                availability, and we reserve the right to modify, update, or discontinue any part of the
                service without prior notice. Users are responsible for providing accurate information
                while placing orders, and any misuse of the platform, including fraudulent activities, may
                result in account suspension or cancellation.
              </p>
              <p className="website-policy-prose__para mb-0">
                We strive to ensure that all product details, pricing, and availability are accurate;
                however, errors may occur, and we reserve the right to correct them at any time. Orders may
                be canceled or refused at our discretion. By making a purchase, you agree to our return,
                refund, and privacy policies. Continued use of the platform indicates your acceptance of
                these terms.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
