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
