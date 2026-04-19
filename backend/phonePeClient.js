const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require("@phonepe-pg/pg-sdk-node");

let cached;

/**
 * PhonePe PG Standard Checkout (v2 OAuth — client id + secret). Returns null if not configured.
 */
function getPhonePeClient() {
  const clientId = process.env.PHONEPE_CLIENT_ID?.trim();
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  const clientVersion = Number(process.env.PHONEPE_CLIENT_VERSION || 1);
  const env = process.env.PHONEPE_ENV === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX;
  const shouldPublishEvents = process.env.PHONEPE_PUBLISH_EVENTS === "1";
  if (!cached) {
    cached = StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env, shouldPublishEvents);
  }
  return cached;
}

function isPhonePeConfigured() {
  return Boolean(process.env.PHONEPE_CLIENT_ID?.trim() && process.env.PHONEPE_CLIENT_SECRET?.trim());
}

/**
 * @param {string} merchantOrderId
 * @param {number} amountPaise
 * @param {string} redirectUrl
 * @param {string} [message]
 */
async function initiateStandardCheckout(merchantOrderId, amountPaise, redirectUrl, message = "Sand24 order") {
  const client = getPhonePeClient();
  if (!client) {
    throw new Error("PhonePe is not configured (PHONEPE_CLIENT_ID / PHONEPE_CLIENT_SECRET).");
  }
  const request = StandardCheckoutPayRequest.builder()
    .merchantOrderId(merchantOrderId)
    .amount(amountPaise)
    .redirectUrl(redirectUrl)
    .message(message)
    .build();

  const response = await client.pay(request);
  const checkoutPageUrl = response.redirectUrl;
  if (!checkoutPageUrl) {
    throw new Error("PhonePe did not return a redirect URL.");
  }
  return checkoutPageUrl;
}

async function fetchOrderStatus(merchantOrderId, details = true) {
  const client = getPhonePeClient();
  if (!client) {
    throw new Error("PhonePe is not configured.");
  }
  return client.getOrderStatus(merchantOrderId, details);
}

module.exports = {
  getPhonePeClient,
  isPhonePeConfigured,
  initiateStandardCheckout,
  fetchOrderStatus,
  StandardCheckoutPayRequest,
  Env,
};
