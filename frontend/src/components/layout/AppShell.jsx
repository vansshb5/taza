import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { PageHeaderProvider } from "../../context/PageHeaderContext";
import LanguageSwitcher from "./LanguageSwitcher";
import { LayoutDashboard, ScanLine, Boxes, ListChecks, QrCode, Sparkles, Bell, Languages, LogOut, User as UserIcon, ChevronDown } from "lucide-react";

import { useAppContext } from "../../context/AppContext";

export default function AppShell() {
  const navigate = useNavigate();
  const { role, user, isAuthenticated, logout } = useAppContext();
  const [profileOpen, setProfileOpen] = useState(false);

  /*
   * Dashboard must point to the currently selected role.
   * Example:
   * Farmer    -> /role/farmer
   * Aggregator -> /role/aggregator
   */
  const dashboardPath = role ? `/role/${role}` : "/";

  const navItems = [
    {
      label: "Dashboard",
      path: dashboardPath,
      icon: LayoutDashboard,
    },
    {
      label: "Inspect Produce",
      path: "/inspect",
      icon: ScanLine,
    },
    {
      label: "Batches",
      path: "/batches",
      icon: Boxes,
    },
    {
      label: "Recommendations",
      path: "/recommendations",
      icon: ListChecks,
    },
    {
      label: "Traceability",
      path: "/traceability",
      icon: QrCode,
    },
    {
      label: "Ops Agent",
      path: "/agent",
      icon: Sparkles,
    },
  ];

  const goHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-bg text-ink">
      {/* =====================================================
          NAVBAR
          ===================================================== */}
      <header className="relative z-50 w-full bg-[#0f3d2b] text-white border-b border-[#24563f]">
        <div className="relative w-full h-[86px] px-6 flex items-center gap-5">
          {/* =================================================
              TAZA LOGO
              ================================================= */}
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-3 shrink-0 text-left cursor-pointer group"
            aria-label="Go to Taza home"
          >
            <img
              src="/favicon.jpg"
              alt="Taza"
              className="w-14 h-14 rounded-full object-cover shrink-0"
            />
            <div className="hidden lg:block">
              <div className="font-display text-2xl font-semibold leading-none group-hover:text-[#b9dfc5] transition-colors">
                Taza
              </div>
              <div className="text-sm text-[#a8c2b4] mt-2">Fresh Intelligence</div>
            </div>
          </button>

          {/* =================================================
              NAVIGATION
              ================================================= */}
          <nav className="flex items-center justify-center gap-1 flex-1 min-w-0 overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.path}
                  className={({ isActive }) => `
                    flex
                    items-center
                    justify-center
                    gap-2
                    px-3
                    py-3
                    rounded-xl
                    whitespace-nowrap
                    text-sm
                    xl:text-base
                    font-medium
                    transition-all
                    shrink-0
                    ${isActive
                      ? "bg-[#285b45] text-white"
                      : "text-[#aec3b8] hover:bg-[#1a4b36] hover:text-white"
                    }
                  `}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="hidden xl:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* =================================================
              RIGHT CONTROLS
              ================================================= */}
          <div className="flex items-center gap-2 shrink-0">
            {/* LANGUAGE */}
            <button
              type="button"
              className="w-11 h-11 rounded-full bg-white text-[#16452f] flex items-center justify-center hover:bg-[#e8f4ec] transition"
              title="Language"
            >
              <Languages size={20} />
            </button>

            {/* NOTIFICATIONS */}
            <button
              type="button"
              className="relative w-11 h-11 rounded-full bg-[#1c4c37] text-white flex items-center justify-center hover:bg-[#285b45] transition"
              title="Notifications"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400" />
            </button>

            {/* PROFILE & AUTH */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="h-11 px-3 rounded-full bg-[#dff3e5] hover:bg-[#cceed6] text-[#16452f] font-bold flex items-center gap-2 transition"
                  title={user?.name || "User Profile"}
                >
                  <span className="text-sm">
                    {user?.name
                      ? user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                      : "OP"}
                  </span>
                  <ChevronDown size={14} className="opacity-70" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 px-4 z-50 text-gray-900">
                    <div className="border-b border-gray-100 pb-2.5 mb-2">
                      <p className="font-bold text-sm text-[#16452f] truncate">
                        {user?.name || "Taza User"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user?.email || ""}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#e8f4ec] text-[#16452f] rounded-full uppercase tracking-wider">
                          {user?.roleLabel || user?.role || "Aggregator"}
                        </span>
                        {user?.organization && (
                          <span className="text-[11px] text-gray-500 truncate">
                            · {user.organization}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setProfileOpen(false);
                        navigate("/login");
                      }}
                      className="w-full text-left text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 py-2 px-2 rounded-xl transition flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="h-11 px-5 rounded-full bg-[#dff3e5] hover:bg-[#cceed6] text-[#16452f] font-bold text-sm flex items-center justify-center transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================
          PAGE CONTENT
          ===================================================== */}
      <main className="w-full min-w-0">
        <PageHeaderProvider>
          <Outlet />
        </PageHeaderProvider>
      </main>
    </div>
  );
}
