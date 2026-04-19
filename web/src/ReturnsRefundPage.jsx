import PublicSiteHeader from "./PublicSiteHeader.jsx";
import PublicSiteFooter from "./PublicSiteFooter.jsx";

export default function ReturnsRefundPage() {
  return (
    <div className="website-home-page">
      <PublicSiteHeader />

      <main className="website-policy-main">
        <section className="website-policy-hero" aria-labelledby="returns-refund-heading">
          <div className="container">
            <h1 id="returns-refund-heading" className="website-policy-hero__title">
              Returns &amp; Refund
            </h1>
          </div>
        </section>

        <section className="website-policy-content" aria-label="Returns and refund policy">
          <div className="container">
            <div className="website-policy-prose">
              <p className="website-policy-prose__para">
                We accept returns only in cases where the product received is damaged or if you have
                received the wrong size compared to what was ordered. To initiate a return, please contact
                our support team within the specified return window with proper proof (such as images of
                the product). Once approved, our team will guide you through the return process.
              </p>
              <p className="website-policy-prose__para mb-0">
                After the returned product is received and verified at our hub, the refund will be
                processed to your original payment method. The amount will typically reflect in your
                account within 2 to 4 business days, depending on your payment provider.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
