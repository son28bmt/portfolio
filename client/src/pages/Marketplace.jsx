import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { motion } from 'framer-motion';
import { ShoppingBag, QrCode, Copy, Mail, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [email, setEmail] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [notice, setNotice] = useState('');
  const [orderResult, setOrderResult] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileRef = useRef();

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products');
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let sse;
    if (orderResult?.payment_ref && orderStatus === 'pending') {
      const baseUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
      sse = new EventSource(`${baseUrl}/sse/orders/${orderResult.payment_ref}`);

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'paid') {
            setOrderStatus('paid');
            fetchProducts();
            sse.close();
          }
        } catch {
          // ignore
        }
      };
    }
    return () => {
      if (sse) sse.close();
    };
  }, [orderResult, orderStatus]);

  const selectedProduct = useMemo(
    () => products.find((item) => Number(item.id) === Number(selectedProductId)) || null,
    [products, selectedProductId]
  );

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    if (!turnstileToken && (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      setError('Hệ thống đang kiểm tra bảo mật (Anti-Bot)... Vui lòng thử lại sau 1 giây.');
      return;
    }

    if (!selectedProduct) {
      setError('Vui lòng chọn sản phẩm trước khi thanh toán.');
      return;
    }

    setCreatingOrder(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.post('/orders', {
        email: String(email || '').trim(),
        product_id: selectedProduct.id,
        turnstileToken
      }, {
        headers: {
          'x-turnstile-token': turnstileToken
        }
      });

      setOrderResult(data);
      setOrderStatus('pending');
      setNotice('Đã tạo đơn thành công. Vui lòng chuyển khoản đúng nội dung để nhận hàng tự động qua email.');
      setTurnstileToken(null);
      if (turnstileRef.current) turnstileRef.current.reset();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo đơn hàng.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setNotice('Đã sao chép nội dung chuyển khoản.');
    } catch {
      setError('Không thể sao chép tự động. Bạn hãy sao chép thủ công.');
    }
  };

  return (
    <div className="py-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-5xl font-black flex items-center gap-3">
            Chợ số tự động
            <ShoppingBag className="w-8 h-8 text-primary" />
          </h1>
          <p className="text-white/60 mt-2 max-w-3xl">
            Mua tài khoản, key và sản phẩm số. Sau khi chuyển khoản thành công, hệ thống sẽ tự động giao hàng qua email.
          </p>
        </div>
        <button
          onClick={fetchProducts}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới sản phẩm
        </button>
      </div>

      {(error || notice) && (
        <div className="space-y-2">
          {notice && (
            <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/10 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {notice}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm">{error}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
        <div className="glass rounded-[28px] p-5 md:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Danh sách sản phẩm</h2>
            <p className="text-xs text-white/50">
              {loading ? 'Đang tải...' : `${products.length.toLocaleString('vi-VN')} sản phẩm`}
            </p>
          </div>

          {loading ? (
            <div className="text-white/40 text-sm p-6 text-center">Đang tải sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="text-white/40 text-sm p-6 text-center">Hiện chưa có sản phẩm nào đang mở bán.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((product) => {
                const active = Number(product.id) === Number(selectedProductId);
                return (
                  <motion.button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    whileHover={{ y: Number(product.quantity) > 0 ? -2 : 0 }}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    } ${Number(product.quantity) <= 0 ? 'opacity-60 saturate-50' : ''}`}
                  >
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">
                      {product.category?.name || 'Chưa phân loại'}
                    </p>
                    <h3 className="font-bold text-base">{product.name}</h3>
                    <p className="text-sm text-white/60 line-clamp-3 mt-2 min-h-[60px]">{product.description || 'Không có mô tả.'}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="font-black text-primary">{formatVnd(product.price)}</p>
                      {Number(product.quantity) > 0 ? (
                        <span className="text-xs text-white/50">Còn {Number(product.quantity).toLocaleString('vi-VN')}</span>
                      ) : (
                        <span className="text-xs text-red-400 font-bold px-2 py-0.5 rounded-md bg-red-400/10">Hết hàng</span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-[28px] p-5 md:p-6 space-y-5 h-fit">
          <h2 className="text-xl font-bold">Thanh toán</h2>

          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-white/50 font-bold">Sản phẩm đã chọn</label>
              <div className="mt-2 p-3 rounded-xl border border-white/10 bg-white/5 text-sm">
                {selectedProduct ? (
                  <div>
                    <p className="font-bold">{selectedProduct.name}</p>
                    <p className="text-primary font-black mt-1">{formatVnd(selectedProduct.price)}</p>
                  </div>
                ) : (
                  <p className="text-white/40">Bạn chưa chọn sản phẩm.</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-white/50 font-bold">Email nhận hàng</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingOrder || !selectedProduct || Number(selectedProduct.quantity) <= 0}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingOrder ? 'Đang tạo đơn...' : Number(selectedProduct?.quantity || 0) <= 0 ? 'Hết hàng' : 'Tạo mã QR thanh toán'}
            </button>

            <div className="opacity-0 pointer-events-none absolute h-0">
              <Turnstile
                ref={turnstileRef}
                siteKey={
                  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? '1x00000000000000000000AA'
                    : (import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA')
                }
                onSuccess={(token) => setTurnstileToken(token)}
                options={{ theme: 'dark', size: 'invisible' }}
              />
            </div>
          </form>

          {orderResult?.qr_url && (
            <div className="space-y-3 border-t border-white/10 pt-4">
              {orderStatus === 'paid' ? (
                <div className="p-6 rounded-2xl border border-green-500/20 bg-green-500/10 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-green-400 text-lg">Thanh toán thành công!</h3>
                  <p className="text-sm text-green-300/80">
                    Sản phẩm của bạn đã được gửi. Vui lòng kiểm tra Email (tất cả các hòm thư nha).
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <QrCode className="w-4 h-4 text-primary" />
                      Mã QR thanh toán
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 bg-orange-400/10 px-3 py-1.5 rounded-full">
                      <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                      Đang chờ...
                    </div>
                  </div>
                  <img src={orderResult.qr_url} alt="Mã QR thanh toán" className="w-full max-w-[280px] mx-auto bg-white p-2 rounded-2xl border border-white/10" />
                  <div className="bg-black/20 border border-white/10 rounded-xl p-3 text-sm">
                    <p className="text-white/50 text-xs mb-1">Nội dung chuyển khoản</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{orderResult.transfer_content || orderResult.payment_ref}</span>
                      <button
                        type="button"
                        onClick={() => copyText(orderResult.transfer_content || orderResult.payment_ref)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-white/50 text-center">
                    Sau khi thanh toán, hệ thống giao hàng tự động vào email của bạn trong vài giây.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
