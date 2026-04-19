import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config.js";
import { useAuth } from "./AuthContext.jsx";

const ShopContext = createContext(null);

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ShopProvider({ children }) {
  const { token } = useAuth();
  const [cartQuantity, setCartQuantity] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) {
      setCartQuantity(0);
      setWishlistCount(0);
      return;
    }
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/me/shop-summary`, {
        headers: authHeaders(token),
      });
      const d = data?.data;
      if (d) {
        setCartQuantity(Number(d.cartQuantity) || 0);
        setWishlistCount(Number(d.wishlistCount) || 0);
      }
    } catch {
      setCartQuantity(0);
      setWishlistCount(0);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToCart = useCallback(
    async (payload) => {
      const { data } = await axios.post(`${API_BASE_URL}/api/me/cart`, payload, {
        headers: authHeaders(token),
      });
      if (data?.cartQuantity != null) setCartQuantity(Number(data.cartQuantity));
      return data;
    },
    [token]
  );

  const removeCartItem = useCallback(
    async (itemId) => {
      const { data } = await axios.delete(`${API_BASE_URL}/api/me/cart/items/${itemId}`, {
        headers: authHeaders(token),
      });
      if (data?.cartQuantity != null) setCartQuantity(Number(data.cartQuantity));
      return data;
    },
    [token]
  );

  const updateCartItemQuantity = useCallback(
    async (itemId, quantity) => {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/me/cart/items/${itemId}`,
        { quantity },
        { headers: authHeaders(token) }
      );
      if (data?.cartQuantity != null) setCartQuantity(Number(data.cartQuantity));
      return data;
    },
    [token]
  );

  const addToWishlist = useCallback(
    async (productId) => {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/me/wishlist`,
        { productId },
        { headers: authHeaders(token) }
      );
      if (data?.wishlistCount != null) setWishlistCount(Number(data.wishlistCount));
      return data;
    },
    [token]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      const { data } = await axios.delete(`${API_BASE_URL}/api/me/wishlist/${productId}`, {
        headers: authHeaders(token),
      });
      if (data?.wishlistCount != null) setWishlistCount(Number(data.wishlistCount));
      return data;
    },
    [token]
  );

  const value = useMemo(
    () => ({
      cartQuantity,
      wishlistCount,
      refresh,
      addToCart,
      removeCartItem,
      updateCartItemQuantity,
      addToWishlist,
      removeFromWishlist,
    }),
    [
      cartQuantity,
      wishlistCount,
      refresh,
      addToCart,
      removeCartItem,
      updateCartItemQuantity,
      addToWishlist,
      removeFromWishlist,
    ]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    throw new Error("useShop must be used within ShopProvider");
  }
  return ctx;
}
