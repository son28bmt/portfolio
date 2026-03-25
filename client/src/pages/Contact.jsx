import React, { useState } from 'react';
import api from '../services/api';
import { motion } from 'framer-motion';
import { Mail, Github, Youtube, Facebook, Send, MapPin, Phone, MessageSquare } from 'lucide-react';

const Contact = () => {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/contact', formState);
      setSubmitted(true);
      setFormState({ name: '', email: '', message: '' });
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
      alert('Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại sau!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialLinks = [
    { name: 'Email', icon: <Mail className="w-6 h-6" />, href: "mailto:Quangsonnguyen2807@gmail.com?subject=Liên hệ từ website&body=Chào bạn Sơn, tôi muốn...", color: 'text-primary' },
    { name: 'GitHub', icon: <Github className="w-6 h-6" />, href: 'https://github.com/son28bmt', color: 'text-white' },
    { name: 'YouTube', icon: <Youtube className="w-6 h-6" />, href: 'https://www.youtube.com/@shanVietsub', color: 'text-red-500' },
    { name: 'Facebook', icon: <Facebook className="w-6 h-6" />, href: 'https://www.facebook.com/Wangsown203', color: 'text-blue-500' },
  ];

  return (
    <div className="py-12 max-w-6xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 md:mb-16 px-4"
      >
        <h1 className="text-3xl md:text-5xl font-bold mb-4">Kết nối với tôi</h1>
        <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto">
          Bạn có ý tưởng hay, một dự án thú vị hoặc chỉ muốn nói lời chào? Đừng ngần ngại liên hệ nhé! 😄
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 px-4 md:px-0">
        {/* Contact Info & Socials */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="glass p-6 md:p-8 rounded-3xl space-y-8">
            <h3 className="text-xl md:text-2xl font-bold flex items-center gap-3">
              Thông tin liên hệ
              <MessageSquare className="text-primary w-5 h-5 md:w-6 md:h-6" />
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2.5 md:p-3 bg-primary/10 rounded-2xl text-primary">
                  <Mail className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-[10px] md:text-sm font-bold text-white/40 uppercase tracking-widest">Email</p>
                  <p className="text-base md:text-lg text-white/80 break-all">Quangsonnguyen2807@gmail.com</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-2.5 md:p-3 bg-secondary/10 rounded-2xl text-secondary">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <p className="text-[10px] md:text-sm font-bold text-white/40 uppercase tracking-widest">Địa điểm</p>
                  <p className="text-base md:text-lg text-white/80">Đà nẵng - Việt Nam</p>
                </div>
              </div>
            </div>

            <div className="pt-6 md:pt-8 border-t border-white/5">
              <p className="text-[10px] md:text-sm font-bold text-white/40 uppercase tracking-widest mb-6">Mạng xã hội</p>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {socialLinks.map((link) => (
                  <a 
                    key={link.name}
                    href={link.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    className="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group"
                  >
                    <div className={`${link.color} group-hover:scale-110 transition-transform`}>
                      {link.icon}
                    </div>
                    <span className="text-xs md:text-sm font-medium text-white/60 group-hover:text-white transition-colors">{link.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
        >
          <div className="glass p-6 md:p-8 rounded-3xl">
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center"
              >
                <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Đã gửi tin nhắn!</h3>
                <p className="text-white/50 mb-8">Cảm ơn bạn đã liên hệ. Tôi sẽ phản hồi sớm nhất có thể.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                >
                  Gửi tin nhắn khác
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">Tên của bạn</label>
                  <input 
                    required
                    type="text" 
                    value={formState.name}
                    onChange={(e) => setFormState({...formState, name: e.target.value})}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">Email</label>
                  <input 
                    required
                    type="email" 
                    value={formState.email}
                    onChange={(e) => setFormState({...formState, email: e.target.value})}
                    placeholder="email@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/40 uppercase tracking-widest ml-1">Tin nhắn</label>
                  <textarea 
                    required
                    rows="5"
                    value={formState.message}
                    onChange={(e) => setFormState({...formState, message: e.target.value})}
                    placeholder="Bạn đang nghĩ gì..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary transition-colors resize-none"
                  ></textarea>
                </div>
                
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all glow disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Gửi tin nhắn
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
