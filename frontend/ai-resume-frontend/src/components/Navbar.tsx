// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { FileSearch, LogOut, Menu, X } from "lucide-react";
import { addAuthExpiredListener, clearAuthSession, getActiveAccessToken } from "../services/auth";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/upload", label: "Upload", end: false },
  { to: "/jobs", label: "Job Search", end: false },
  { to: "/dashboard", label: "Dashboard", end: false },
  { to: "/profile", label: "Profile", end: false },
  { to: "/about", label: "About", end: false },
];

const readAuth = () => {
  try {
    const token = getActiveAccessToken();
    return {
      loggedIn: !!token,
      username: token ? localStorage.getItem("username") || "" : "",
    };
  } catch {
    return { loggedIn: false, username: "" };
  }
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState(readAuth);
  const [menuOpen, setMenuOpen] = useState(false);

  // Re-check login state on every page change (fixes stale "Login" button
  // right after signing in) and when another tab logs in/out.
  useEffect(() => {
    setAuth(readAuth());
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const sync = () => setAuth(readAuth());
    window.addEventListener("storage", sync);
    const removeExpiredListener = addAuthExpiredListener(sync);
    return () => {
      window.removeEventListener("storage", sync);
      removeExpiredListener();
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setAuth({ loggedIn: false, username: "" });
    setMenuOpen(false);
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
      isActive
        ? "bg-green-100 text-green-800"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  const initial = (auth.username || "U").charAt(0).toUpperCase();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/90 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-md">
            <FileSearch size={22} />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-gray-900 sm:text-lg">
              Resume ATS Checker
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">
              by Anish Singh
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden items-center gap-3 md:flex">
          {auth.loggedIn ? (
            auth.username ? (
              <>
                <div className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-1 pr-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
                  {initial}
                </span>
                <span className="max-w-[8rem] truncate text-sm font-medium text-gray-800">
                    {auth.username}
                </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <LogOut size={16} /> Logout
                </button>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <LogOut size={16} /> Logout
              </button>
            )
          ) : (
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 md:hidden"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Accent line */}
      <div className="h-[3px] w-full bg-gradient-to-r from-green-500 via-emerald-400 to-teal-500" />

      {/* Mobile panel */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full border-b border-gray-200 bg-white p-3 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-base font-medium ${
                    isActive ? "bg-green-100 text-green-800" : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            {auth.loggedIn ? (
              <div className="flex items-center justify-between gap-3 px-1">
                {auth.username ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 font-semibold text-white">
                    {initial}
                  </span>
                    <span className="truncate font-medium text-gray-800">{auth.username}</span>
                </span>
                ) : <span />}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="block rounded-xl border border-gray-300 py-2.5 text-center font-medium text-gray-800"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
