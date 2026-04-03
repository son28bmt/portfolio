import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Terms = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-12 px-4 md:px-0 max-w-4xl mx-auto space-y-12"
    >
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors group mb-8"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại Trang chủ</span>
      </Link>

      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-primary w-8 h-8" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-wider">Điều khoản sử dụng</h1>
        </div>
        <p className="text-white/40 italic">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
      </header>

      <section className="prose prose-invert max-w-none glass p-8 md:p-12 rounded-[40px] border-white/5 space-y-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary">1. Chấp nhận Điều khoản</h2>
          <p className="text-white/70 leading-relaxed">
            Bằng việc truy cập hoặc sử dụng website này, bạn đồng ý tuân thủ các Điều khoản sử dụng này. Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản, vui lòng không sử dụng dịch vụ của chúng tôi.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary">2. Quyền sở hữu trí tuệ</h2>
          <p className="text-white/70 leading-relaxed">
            Toàn bộ nội dung trên website bao gồm hình ảnh, video, mã nguồn, bài viết đều thuộc quyền sở hữu của Nguyễn Quang Sơn (hoặc được cấp phép sử dụng hợp pháp). Bạn không được phép sao chép hoặc thương mại hóa khi chưa có sự đồng ý bằng văn bản.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary">3. Sử dụng dịch vụ</h2>
          <p className="text-white/70 leading-relaxed">
            Người dùng cam kết cung cấp thông tin chính xác khi sử dụng các tính năng liên hệ hoặc mua hàng tự động. Nghiêm cấm mọi hành vi tấn công, phá hoại hoặc can thiệp bất hợp pháp vào hệ thống của website.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary">4. Giới thiệu sản phẩm kỹ thuật số</h2>
          <p className="text-white/70 leading-relaxed">
            Các sản phẩm số được bán trên "Chợ số tự động" sẽ được giao tự động qua email sau khi thanh toán thành công. Do tính chất đặc thù của hàng kỹ thuật số, chúng tôi không hỗ trợ hoàn tiền sau khi mã đã được gửi đi, trừ trường hợp lỗi kỹ thuật từ phía hệ thống.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-secondary">5. Liên hệ giải quyết tranh chấp</h2>
          <p className="text-white/70 leading-relaxed">
            Mọi khiếu nại hoặc thắc mắc sẽ được giải quyết trên tinh thần hợp tác và thương lượng. Bạn có thể liên hệ trực tiếp qua mục "Liên hệ" trên website để được hỗ trợ nhanh nhất.
          </p>
        </div>
      </section>

      <div className="text-center py-12">
        <Link 
          to="/lien-he" 
          className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:scale-105 transition-transform shadow-xl glow inline-block"
        >
          Tôi có thắc mắc khác
        </Link>
      </div>
    </motion.div>
  );
};

export default Terms;
