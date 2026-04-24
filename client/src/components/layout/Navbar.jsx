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

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
  }, [isOpen]);

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
        className="glass fixed left-0 right-0 top-0 z-50 flex h-16 items-center md:h-20"
      >
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 md:px-6">
          <Link
            to="/"
            className="text-gradient z-50 max-w-[calc(100vw-4.5rem)] truncate font-display text-lg font-bold sm:max-w-none sm:text-xl md:text-2xl"
          >
            Nguyen Quang Son
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <ul className="flex gap-8">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={`relative text-sm font-medium transition-colors hover:text-primary ${
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
              <div className="flex items-center gap-3">
                <Link
                  to="/tai-khoan"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  <UserCircle2 className="h-4 w-4 text-secondary" />
                  {account?.fullName || account?.username || 'Tài khoản'}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/dang-nhap"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/10"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/dang-ky"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          <button
            className="z-50 p-1.5 text-white md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col gap-8 text-center">
              {navLinks.map((link, i) => (
                <motion.li
                  key={link.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link
                    to={link.path}
                    className={`text-2xl font-semibold transition-colors hover:text-primary ${
                      isLinkActive(link.path) ? 'text-primary' : 'text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/tai-khoan"
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-lg font-semibold text-white"
                  >
                    {account?.fullName || account?.username || 'Tài khoản'}
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-lg font-semibold text-red-300"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/dang-nhap"
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-lg font-semibold text-white"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/dang-ky"
                    className="rounded-2xl bg-primary px-6 py-3 text-lg font-semibold text-white"
                  >
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
