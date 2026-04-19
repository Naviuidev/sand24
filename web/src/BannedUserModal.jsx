/** Shown when the API returns USER_BANNED (account disabled by admin). */
export function BannedUserModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="website-auth-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="website-auth-modal website-auth-modal--with-brand"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="banned-user-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="website-auth-modal__head">
          <img
            src="/sand24-logo-mark.png"
            alt="Sand 24"
            className="website-auth-modal__logo"
            width={140}
            height={56}
            decoding="async"
          />
        </div>
        <div className="website-auth-modal__body text-center">
          <h2 id="banned-user-title" className="website-auth-modal__title mb-2">
            Access restricted
          </h2>
          <p className="website-auth-modal__sub mb-0">
            You are not authorised to use Sand 24 products.
          </p>
          <button type="button" className="btn website-auth-modal__btn mt-3" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
