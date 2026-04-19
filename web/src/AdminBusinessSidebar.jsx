import { useNavigate } from "react-router-dom";

/**
 * Single admin sidebar for Customise Business + Blog. Same tabs everywhere.
 * @param {{ activeItem: string, onBusinessSection?: (section: string) => void }} props
 * — When `onBusinessSection` is set (business page), section buttons only update parent state.
 * — When omitted (blog page), section buttons navigate to `/admin/costomise-bussiness` with state.
 */
export default function AdminBusinessSidebar({ activeItem, onBusinessSection }) {
  const navigate = useNavigate();

  const goSection = (section) => {
    if (onBusinessSection) onBusinessSection(section);
    else navigate("/admin/costomise-bussiness", { state: { section } });
  };

  return (
    <aside className="customize-sidebar">
      <div>
        <img src="/admin-logo.png" alt="Sand24 logo" className="customize-logo" />
        <p className="admin-subtitle mb-4">Sand24 Admin</p>

        <p className="business-sidebar-label mb-2">Business</p>
        <nav className="customize-nav">
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "categories" ? "active" : ""}`}
            onClick={() => goSection("categories")}
          >
            Categories
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "products" ? "active" : ""}`}
            onClick={() => goSection("products")}
          >
            Products
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "users" ? "active" : ""}`}
            onClick={() => goSection("users")}
          >
            Users
          </button>
        </nav>

        <p className="business-sidebar-label mb-2 mt-3">Orders</p>
        <nav className="customize-nav">
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "order_details" ? "active" : ""}`}
            onClick={() => goSection("order_details")}
          >
            Order details
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "order_shipped" ? "active" : ""}`}
            onClick={() => goSection("order_shipped")}
          >
            Shipped
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "order_delivered" ? "active" : ""}`}
            onClick={() => goSection("order_delivered")}
          >
            Delivered
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "support_queries" ? "active" : ""}`}
            onClick={() => goSection("support_queries")}
          >
            Customer queries
          </button>
        </nav>

        <p className="business-sidebar-label mb-2 mt-3">Content</p>
        <nav className="customize-nav">
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "blog" ? "active" : ""}`}
            onClick={() => navigate("/admin/blog")}
          >
            Blog (Journal)
          </button>
          <button
            type="button"
            className={`customize-nav-item ${activeItem === "contact_form" ? "active" : ""}`}
            onClick={() => goSection("contact_form")}
          >
            Contact form
          </button>
        </nav>
      </div>
    </aside>
  );
}
