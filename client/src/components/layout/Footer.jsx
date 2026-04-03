import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Mail, ArrowRight, MessageSquare, BookOpen, ShoppingBag, Globe, Shield } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface pt-16 pb-8 border-t border-white/5">
      <div className="container mx-auto px-4 md:px-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Column 1: Brand */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-primary uppercase tracking-tighter flex items-center gap-2">
                Nguyễn Quang Sơn
                <Globe className="w-5 h-5 text-secondary animate-pulse" />
              </h2>
              <p className="text-white/40 text-sm mt-4 leading-relaxed max-w-xs">
                Chia sẻ các kiến thức. Giúp bạn tiếp cận công nghệ dễ dàng.
              </p>
            </div>
            <div className="flex gap-4">
              <a 
                href="https://www.facebook.com/Wangsown203" 
                target="_blank" 
                rel="noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href="mailto:Quangsonnguyen2807@gmail.com"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-secondary/20 hover:text-secondary transition-all duration-300"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Liên kết nhanh</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/cua-hang" className="text-white/40 hover:text-white text-sm flex items-center gap-2 transition-colors">
                  <ShoppingBag className="w-3.5 h-3.5" /> Sản phẩm
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-white/40 hover:text-white text-sm flex items-center gap-2 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" /> Blog
                </Link>
              </li>
              <li>
                <Link to="/playground/chat" className="text-white/40 hover:text-white text-sm flex items-center gap-2 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" /> Hỏi đáp
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Hỗ trợ</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/dieu-khoan" className="text-white/40 hover:text-white text-sm flex items-center gap-2 transition-colors">
                   Điều Khoản Sử Dụng
                </Link>
              </li>
              <li>
                <Link to="/lien-he" className="text-white/40 hover:text-white text-sm flex items-center gap-2 transition-colors">
                   Liên Hệ
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Nhận thông báo</h3>
            <p className="text-white/40 text-sm">Đăng ký nhận tin mới</p>
            <form className="relative mt-4 group" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Email của bạn" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-4 pr-12 text-sm focus:outline-none focus:border-primary transition-all duration-300"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:scale-110 transition-transform shadow-lg glow">
                <ArrowRight className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest">
            © {currentYear} Nguyễn Quang Sơn. Vibe with AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/dieu-khoan" className="text-[11px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
              Điều khoản
            </Link>
            <Link to="/bao-mat" className="text-[11px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">
              Bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
