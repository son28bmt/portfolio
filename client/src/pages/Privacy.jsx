import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Privacy = () => {
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
          <Lock className="text-secondary w-8 h-8" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-wider">Chính sách bảo mật</h1>
        </div>
        <p className="text-white/40 italic">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
      </header>

      <section className="prose prose-invert max-w-none glass p-8 md:p-12 rounded-[40px] border-white/5 space-y-10">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">1. Dữ liệu chúng tôi thu thập</h2>
          <p className="text-white/70 leading-relaxed">
            Chúng tôi chỉ thu thập thông tin cá nhân cơ bản khi bạn chủ động cung cấp, bao gồm:
          </p>
          <ul className="list-disc list-inside text-white/60 space-y-2 pl-4">
            <li>Tên và Email (khi bạn gửi tin nhắc hoặc nạp thẻ / mua hàng).</li>
            <li>Thông tin chuyển khoản (chỉ lưu mã giao dịch và nội dung để đối soát tự động).</li>
            <li>Cookies (để phân tích lượt truy cập ẩn danh qua Google Analytics).</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">2. Mục đích sử dụng thông tin</h2>
          <p className="text-white/70 leading-relaxed">
            Mọi thông tin thu thập được chỉ dùng cho mục đích:
          </p>
          <ul className="list-disc list-inside text-white/60 space-y-2 pl-4">
            <li>Phản hồi tin nhắn và hỗ trợ kỹ thuật khách hàng.</li>
            <li>Xử lý đơn hàng tự động và gửi sản phẩm số qua email kịp thời.</li>
            <li>Tối ưu hóa trải nghiệm người dùng trên website (không quảng cáo phiền nhiễu).</li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">3. Cam kết bảo vệ dữ liệu</h2>
          <p className="text-white/70 leading-relaxed">
            Chúng tôi cam kết tuyệt đối không bán, thuê hay chia sẻ thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào. Hệ thống thanh toán được tích hợp qua SePay/VietQR đảm bảo an toàn, không lưu trữ thông tin nhạy cảm của tài khoản ngân hàng người dùng.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">4. Quyền của người dùng</h2>
          <p className="text-white/70 leading-relaxed">
            Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa bộ dữ liệu cá nhân của mình khỏi hệ thống của Nguyễn Quang Sơn bất cứ lúc nào bằng cách liên hệ qua mục Hỗ trợ.
          </p>
        </div>
      </section>

      <div className="text-center py-12">
        <p className="text-white/40 mb-6 italic">Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của Tạp hoá AI và Nguyễn Quang Sơn.</p>
        <Link 
          to="/" 
          className="px-10 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all shadow-xl"
        >
          Tôi đã hiểu
        </Link>
      </div>
    </motion.div>
  );
};

export default Privacy;
