import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import Home from '../pages/Home';
import About from '../pages/About';
import Projects from '../pages/Projects';
import ProjectDetail from '../pages/ProjectDetail';
import Blog from '../pages/Blog';
import BlogDetail from '../pages/BlogDetail';
import Contact from '../pages/Contact';
import Playground from '../pages/Playground';
import Donate from '../pages/Donate';
import Marketplace from '../pages/Marketplace';
import MarketplaceCards from '../pages/MarketplaceCards';
import MarketplaceHome from '../pages/MarketplaceHome';
import Terms from '../pages/Terms';
import Privacy from '../pages/Privacy';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Account from '../pages/Account';
import { useAuth } from '../context/AuthContext';

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
    className="w-full"
  >
    {children}
  </motion.div>
);

const ProtectedPage = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="py-20 text-center text-white/50">Đang tải dữ liệu tài khoản...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/gioi-thieu" element={<PageTransition><About /></PageTransition>} />
        <Route path="/du-an" element={<PageTransition><Projects /></PageTransition>} />
        <Route path="/du-an/:id" element={<PageTransition><ProjectDetail /></PageTransition>} />
        <Route path="/blog" element={<PageTransition><Blog /></PageTransition>} />
        <Route path="/blog/:id" element={<PageTransition><BlogDetail /></PageTransition>} />
        <Route path="/lien-he" element={<PageTransition><Contact /></PageTransition>} />
        <Route path="/cua-hang" element={<PageTransition><MarketplaceHome /></PageTransition>} />
        <Route
          path="/cua-hang/dich-vu"
          element={
            <PageTransition>
              <Marketplace
                catalogMode="supplier"
                breadcrumbLabel="Dịch vụ số"
                pageTitle="Dịch vụ số"
                pageDescription="Chọn nền tảng, lọc đúng nhóm dịch vụ rồi bấm vào gói bạn muốn mua. Phần cấu hình và thanh toán sẽ hiện ngay ở khung bên phải."
                alternateLink="/cua-hang/account"
                alternateLabel="Account & key"
              />
            </PageTransition>
          }
        />
        <Route
          path="/cua-hang/account"
          element={
            <PageTransition>
              <Marketplace
                catalogMode="local"
                breadcrumbLabel="Account & key"
                pageTitle="Account & key"
                pageDescription="Khu này dành cho những sản phẩm bạn tự nhập và tự quản lý trong kho nội bộ. Chọn sản phẩm rồi cấu hình đơn hàng ở khung bên phải."
                alternateLink="/cua-hang/dich-vu"
                alternateLabel="Dịch vụ số"
              />
            </PageTransition>
          }
        />
        <Route path="/cua-hang/card" element={<PageTransition><MarketplaceCards /></PageTransition>} />
        <Route path="/dang-nhap" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/dang-ky" element={<PageTransition><Register /></PageTransition>} />
        <Route
          path="/tai-khoan"
          element={
            <PageTransition>
              <ProtectedPage>
                <Account />
              </ProtectedPage>
            </PageTransition>
          }
        />
        <Route path="/donate" element={<PageTransition><Donate /></PageTransition>} />
        <Route path="/dieu-khoan" element={<PageTransition><Terms /></PageTransition>} />
        <Route path="/bao-mat" element={<PageTransition><Privacy /></PageTransition>} />
        <Route path="/playground/*" element={<PageTransition><Playground /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

export default AppRoutes;
