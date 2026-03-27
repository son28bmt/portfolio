import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Trang Chủ', path: '/' },
    { name: 'Giới Thiệu', path: '/gioi-thieu' },
    { name: 'Dự Án', path: '/du-an' },
    { name: 'Blog', path: '/blog' },
    { name: 'Liên Hệ', path: '/lien-he' },
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
        className="fixed top-0 left-0 right-0 z-50 glass h-16 md:h-20 flex items-center"
      >
        <div className="container mx-auto px-3 sm:px-4 md:px-6 flex justify-between items-center">
          <Link
            to="/"
            className="text-lg sm:text-xl md:text-2xl font-bold font-display text-gradient z-50 max-w-[calc(100vw-4.5rem)] sm:max-w-none truncate"
          >
            Nguyễn Quang Sơn
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex gap-8">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`text-sm font-medium hover:text-primary transition-colors relative ${
                    isLinkActive(link.path) ? 'text-primary' : 'text-white/70'
                  }`}
                >
                  {link.name}
                  {isLinkActive(link.path) && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-white z-50 p-1.5"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl md:hidden flex flex-col items-center justify-center"
          >
            <ul className="flex flex-col gap-8 text-center">
              {navLinks.map((link, i) => (
                <motion.li
                  key={link.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={link.path}
                    className={`text-2xl font-semibold hover:text-primary transition-colors ${
                      isLinkActive(link.path) ? 'text-primary' : 'text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
