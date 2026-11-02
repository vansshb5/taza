import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser } from "../api/auth";

const AppContext = createContext(null);

export const ROLES = {
  FARMER: "farmer",
  AGGREGATOR: "aggregator",
  PACK_HOUSE: "pack-house",
  MANDI: "mandi",
  WAREHOUSE: "warehouse",
  COLD_CHAIN: "cold-chain",
  RETAILER: "retailer",
  CONSUMER: "consumer",
};

export const ROLE_LABELS = {
  [ROLES.FARMER]: "Farmer",
  [ROLES.AGGREGATOR]: "Aggregator",
  [ROLES.PACK_HOUSE]: "Pack House",
  [ROLES.MANDI]: "Mandi",
  [ROLES.WAREHOUSE]: "Warehouse",
  [ROLES.COLD_CHAIN]: "Cold Chain",
  [ROLES.RETAILER]: "Retailer",
  [ROLES.CONSUMER]: "Consumer",
};

export function AppProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("taza_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Verify JWT session on app mount
  useEffect(() => {
    const token = localStorage.getItem("taza_token");
    if (token) {
      getCurrentUser()
        .then((fetchedUser) => {
          if (fetchedUser) {
            const role = fetchedUser.role || ROLES.AGGREGATOR;
            const updated = {
              ...fetchedUser,
              role,
              roleLabel: ROLE_LABELS[role] || role,
            };
            setUser(updated);
            localStorage.setItem("taza_user", JSON.stringify(updated));
          }
        })
        .catch(() => {
          // If token expired, clear credentials
          logout();
        });
    }
  }, []);

  // Login via API with JWT token
  const loginWithAuth = (token, userData) => {
    localStorage.setItem("taza_token", token);
    const role = userData.role || ROLES.AGGREGATOR;
    const nextUser = {
      ...userData,
      role,
      roleLabel: ROLE_LABELS[role] || role,
    };
    setUser(nextUser);
    localStorage.setItem("taza_user", JSON.stringify(nextUser));
    return nextUser;
  };

  // Mock / demo role switcher compatibility
  const login = (role, userData = {}) => {
    const nextUser = {
      ...userData,
      role,
      roleLabel: ROLE_LABELS[role] || role,
    };
    setUser(nextUser);
    localStorage.setItem("taza_user", JSON.stringify(nextUser));
    return nextUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("taza_token");
    localStorage.removeItem("taza_user");
  };

  const value = {
    sidebarCollapsed,
    toggleSidebar: () => setSidebarCollapsed((val) => !val),
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    loginWithAuth,
    login,
    logout,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
