import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { Menu, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { pathname } = useLocation();
  const { account, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Giới thiệu', path: '/gioi-thieu' },
    { name: 'Dự án', path: '/du-an' },
    { name: 'Blog', path: '/blog' },
    { name: 'Cửa hàng', path: '/cua-hang' },
    { name: 'Liên hệ', path: '/lien-he' },
    { name: 'Donate', path: '/donate' },
    { name: 'Playground', path: '/playground' },
  ];

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle escape key and auto-close when resizing to desktop screen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isLinkActive = (linkPath) => {
    if (linkPath === '/') return pathname === '/';
    if (linkPath === '/playground') {
      return pathname === '/playground' || pathname.startsWith('/playground/');
    }
    return pathname === linkPath || pathname.startsWith(`${linkPath}/`);
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="glass fixed left-0 right-0 top-0 z-50 flex h-16 items-center lg:h-20"
      >
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 lg:px-6">
          <Link
            to="/"
            className="text-gradient z-50 shrink-0 font-display text-lg font-bold whitespace-nowrap sm:text-xl lg:text-2xl"
          >
            Nguyen Quang Son
          </Link>

          {/* Desktop Navigation (>= lg: 1024px) */}
          <div className="hidden items-center gap-3 lg:flex xl:gap-6 2xl:gap-8">
            <ul className="flex items-center gap-2 xl:gap-4 2xl:gap-6">
              {navLinks.map((link) => (
                <li key={link.path} className="shrink-0">
                  <Link
                    to={link.path}
                    className={`relative whitespace-nowrap text-xs font-medium transition-colors hover:text-primary xl:text-sm ${
                      isLinkActive(link.path) ? 'text-primary' : 'text-white/70'
                    }`}
                  >
                    {link.name}
                    {isLinkActive(link.path) && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            {isAuthenticated ? (
              <div className="flex shrink-0 items-center gap-2 xl:gap-3">
                <Link
                  to="/tai-khoan"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 xl:gap-2 xl:px-4 xl:py-2 xl:text-sm"
                >
                  <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-secondary xl:h-4 xl:w-4" />
                  <span className="max-w-[85px] truncate xl:max-w-[130px]">
                    {account?.fullName || account?.username || 'Tài khoản'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white whitespace-nowrap xl:px-4 xl:py-2 xl:text-sm"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2 xl:gap-3">
                <Link
                  to="/dang-nhap"
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/75 transition-colors hover:bg-white/10 whitespace-nowrap xl:px-4 xl:py-2 xl:text-sm"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/dang-ky"
                  className="shrink-0 rounded-full bg-primary px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90 whitespace-nowrap xl:px-4 xl:py-2 xl:text-sm"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right Controls (< lg) */}
          <div className="z-50 flex items-center gap-2 lg:hidden">
            {isAuthenticated && (
              <Link
                to="/tai-khoan"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10"
                aria-label="Tài khoản"
              >
                <UserCircle2 className="h-3.5 w-3.5 text-secondary" />
                <span className="max-w-[80px] truncate sm:max-w-[120px]">
                  {account?.fullName || account?.username || 'Tài khoản'}
                </span>
              </Link>
            )}

            <button
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Drawer (< lg) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex min-h-full flex-col items-center justify-center px-6 py-20">
              <ul className="flex flex-col gap-6 text-center">
                {navLinks.map((link, i) => (
                  <motion.li
                    key={link.path}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className={`text-xl font-semibold transition-colors hover:text-primary ${
                        isLinkActive(link.path) ? 'text-primary' : 'text-white'
                      }`}
                    >
                      {link.name}
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/tai-khoan"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                    >
                      <UserCircle2 className="h-5 w-5 text-secondary" />
                      <span className="truncate">
                        {account?.fullName || account?.username || 'Tài khoản'}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        logout();
                      }}
                      className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-base font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      Đăng xuất
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/dang-nhap"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      to="/dang-ky"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary/90"
                    >
                      Đăng ký
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
