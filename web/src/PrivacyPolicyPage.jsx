import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function PrivacyPolicyPage() {
  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-policy-main">
        <section className="website-policy-hero" aria-labelledby="privacy-policy-heading">
          <div className="container">
            <h1 id="privacy-policy-heading" className="website-policy-hero__title">
              Privacy Policy
            </h1>
          </div>
        </section>

        <section className="website-policy-content" aria-label="Privacy policy">
          <div className="container">
            <div className="website-policy-prose">
              <p className="website-policy-prose__para">
                We value your privacy and are committed to protecting your personal information. Any
                details you provide, such as your name, contact number, email address, and shipping
                information, are collected only for order processing, delivery, and customer support
                purposes. We do not sell, trade, or share your personal information with third parties,
                except when required to fulfill your order (such as delivery partners) or comply with
                legal obligations.
              </p>
              <p className="website-policy-prose__para mb-0">
                All your data is stored securely, and we take appropriate measures to prevent unauthorized
                access, misuse, or disclosure. By using our website or app, you agree to the collection and
                use of your information in accordance with this policy. We may update this Privacy Policy
                from time to time, and any changes will be reflected on this page.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
