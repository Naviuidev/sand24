import { API_BASE_URL } from "./config.js";

export function formatRupeeInr(amount) {
  const n = Math.round(Number(amount) || 0);
  return `₹ ${n.toLocaleString("en-IN")} INR`;
}

/** Product detail hero price (e.g. Rs. 3,599.00). */
export function formatRsDecimals(amount) {
  const n = Number(amount);
  const v = Number.isFinite(n) ? n : 0;
  return `Rs. ${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Product image preview URL (slots 1–4). */
export function productImageSrc(productId, slot = 1) {
  return `${API_BASE_URL}/api/products/${productId}/images/${slot}/preview`;
}

/** Neutral placeholder when a product has no photo or slot is missing. */
export const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#eceae6" width="400" height="500"/><text x="200" y="252" text-anchor="middle" fill="#8a8580" font-family="system-ui,sans-serif" font-size="15">No image</text></svg>'
  );

/** First slot that has an image (`imageSlots` from API), or 1 if unknown. */
export function productPrimaryImageSlot(product) {
  if (product && Array.isArray(product.imageSlots) && product.imageSlots.length > 0) {
    return product.imageSlots[0];
  }
  if (product?.primaryImageSlot != null) return product.primaryImageSlot;
  return 1;
}

export function productHasImages(product) {
  return Array.isArray(product?.imageSlots) && product.imageSlots.length > 0;
}
