/**
 * Empty string = same-origin `/api` (Vite dev proxy, or production nginx → Node).
 * Set `VITE_API_BASE_URL` when the API is on another origin, or for `vite preview`
 * (preview has no proxy — e.g. `VITE_API_BASE_URL=http://localhost:5001`).
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
