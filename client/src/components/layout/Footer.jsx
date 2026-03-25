import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-surface py-12 border-t border-white/5">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <p className="text-white/40 text-sm mb-4">
          © {new Date().getFullYear()} Nguyễn Quang Sơn. vibe Coding with AI
        </p>
        <div className="flex justify-center gap-6">
          <a href="https://github.com/son28bmt" className="text-white/60 hover:text-secondary transition-colors">GitHub</a>
          <a href="https://www.linkedin.com/in/nguyễn-quang-sơn-858b82358" className="text-white/60 hover:text-secondary transition-colors">LinkedIn</a>
          <a href="#" className="text-white/60 hover:text-secondary transition-colors">YouTube</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
