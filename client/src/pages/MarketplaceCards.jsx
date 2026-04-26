import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const normalizeSourceConfig = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const getCardProviderMeta = (product) => {
  const sourceConfig = normalizeSourceConfig(product?.sourceConfig);
  const serviceCode = String(sourceConfig.serviceCode || '').trim();
  const categoryName = String(product?.category?.name || '').trim();
  const serviceName = String(sourceConfig.serviceName || product?.name || '').trim();

  const name = serviceCode || categoryName || serviceName || 'Card';
  return {
    key: name.toLowerCase(),
    name,
  };
};

const getCardValueLabel = (product) => {
  const sourceConfig = normalizeSourceConfig(product?.sourceConfig);
  const value = Number(sourceConfig.cardValue || product?.price || 0);
  return value > 0 ? `${value.toLocaleString('vi-VN')}đ` : 'Mệnh giá khác';
};

const isCardProduct = (product) =>
  product?.sourceType === 'supplier_api' &&
  normalizeSourceConfig(product?.sourceConfig)?.supplierKind === 'digital_code';

const TrackerBadge = ({ status, label }) => {
  const palette =
    status === 'delivered'
      ? 'border-green-500/20 bg-green-500/10 text-green-300'
      : status === 'processing'
        ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
        : status === 'manual_review'
          ? 'border-orange-500/20 bg-orange-500/10 text-orange-300'
          : status === 'failed'
            ? 'border-red-500/20 bg-red-500/10 text-red-300'
            : 'border-white/10 bg-white/10 text-white/70';

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${palette}`}>
      {label}
    </span>
  );
};

const MarketplaceCards = () => {
  const { isAuthenticated, account, refreshAccount } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [walletNotice, setWalletNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedBankKey, setSelectedBankKey] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [orderFulfillmentStatus, setOrderFulfillmentStatus] = useState(null);
  const [trackerRef, setTrackerRef] = useState('');
  const [trackerSummary, setTrackerSummary] = useState(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const hasPaymentChoices = paymentAccounts.length > 1;

  const turnstileRef = useRef();
  const emailInputRef = useRef();
  const quantityInputRef = useRef();

  const fetchProducts = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/products');
      setProducts(Array.isArray(data) ? data.filter(isCardProduct) : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách card.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentAccounts = async () => {
    try {
      const { data } = await api.get('/payment-accounts');
      const accounts = Array.isArray(data?.items) ? data.items : [];
      setPaymentAccounts(accounts);
      setSelectedBankKey((prev) => prev || accounts[0]?.key || '');
    } catch {
      setPaymentAccounts([]);
    }
  };

  const fetchOrderSummary = async (paymentRef, { silent = false } = {}) => {
    const cleanRef = String(paymentRef || '').trim();
    if (!cleanRef) {
      setTrackerSummary(null);
      return;
    }

    if (!silent) {
      setTrackerLoading(true);
      setError('');
    }

    try {
      const { data } = await api.get(`/orders/${cleanRef}`);
      setTrackerSummary(data);
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || 'Không thể tra cứu đơn hàng.');
      }
      setTrackerSummary(null);
    } finally {
      if (!silent) {
        setTrackerLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchPaymentAccounts();
  }, []);

  useEffect(() => {
    let sse;
    const paymentRef = orderResult?.payment_ref;
    const shouldTrack =
      paymentRef &&
      (orderStatus === 'pending' ||
        (orderStatus === 'paid' && orderFulfillmentStatus === 'processing'));

    if (shouldTrack) {
      const baseUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
      sse = new EventSource(`${baseUrl}/sse/orders/${paymentRef}`);

      sse.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'paid') {
            const nextStatus = data.fulfillmentStatus || orderFulfillmentStatus || 'delivered';
            setOrderStatus('paid');
            setOrderFulfillmentStatus(nextStatus);
            await fetchOrderSummary(paymentRef, { silent: true });
            await fetchProducts();
            if (nextStatus !== 'processing') {
              sse.close();
            }
          }
        } catch {
          // Ignore malformed payload
        }
      };
    }

    return () => {
      if (sse) sse.close();
    };
  }, [orderFulfillmentStatus, orderResult, orderStatus]);

  const providerGroups = useMemo(() => {
    const groups = new Map();

    products.forEach((product) => {
      const provider = getCardProviderMeta(product);
      if (!groups.has(provider.key)) {
        groups.set(provider.key, {
          key: provider.key,
          name: provider.name,
          items: [],
        });
      }
      groups.get(provider.key).items.push(product);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => {
          const aValue = Number(normalizeSourceConfig(a.sourceConfig).cardValue || 0);
          const bValue = Number(normalizeSourceConfig(b.sourceConfig).cardValue || 0);
          return aValue - bValue;
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [products]);

  useEffect(() => {
    if (!providerGroups.length) return;
    if (!selectedProviderKey || !providerGroups.some((item) => item.key === selectedProviderKey)) {
      setSelectedProviderKey(providerGroups[0].key);
    }
  }, [providerGroups, selectedProviderKey]);

  const filteredProviders = useMemo(() => {
    const keyword = String(search || '').trim().toLowerCase();
    if (!keyword) return providerGroups;

    return providerGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((product) => {
          const sourceConfig = normalizeSourceConfig(product?.sourceConfig);
          const haystack = [
            product?.name,
            product?.description,
            product?.category?.name,
            sourceConfig.serviceCode,
            sourceConfig.serviceName,
            getCardValueLabel(product),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(keyword);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [providerGroups, search]);

  const activeProvider = useMemo(() => {
    if (!filteredProviders.length) return null;
    return filteredProviders.find((item) => item.key === selectedProviderKey) || filteredProviders[0];
  }, [filteredProviders, selectedProviderKey]);

  useEffect(() => {
    if (!activeProvider?.items?.length) {
      setSelectedProductId(null);
      return;
    }

    const exists = activeProvider.items.some((item) => Number(item.id) === Number(selectedProductId));
    if (!exists) {
      setSelectedProductId(activeProvider.items[0].id);
    }
  }, [activeProvider, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((item) => Number(item.id) === Number(selectedProductId)) || null,
    [products, selectedProductId],
  );

  const selectedSourceConfig = useMemo(
    () => normalizeSourceConfig(selectedProduct?.sourceConfig),
    [selectedProduct],
  );

  const allowsQuantity = Boolean(selectedSourceConfig.allowsQuantity);

  useEffect(() => {
    if (!selectedProduct) {
      setQuantity('1');
      return;
    }

    setQuantity(String(Math.max(1, Number(selectedSourceConfig.defaultQuantity || 1))));
  }, [selectedProduct, selectedSourceConfig]);

  const estimatedAmount = useMemo(() => {
    const count = allowsQuantity ? Math.max(1, Number(quantity || 1)) : 1;
    return Math.round(Number(selectedProduct?.price || 0) * count);
  }, [allowsQuantity, quantity, selectedProduct]);

  const walletBalance = Number(account?.wallet?.balance || 0);
  const canWalletCheckout =
    isAuthenticated && selectedProduct && walletBalance >= Number(estimatedAmount || 0);

  const trackerStatus = trackerSummary?.fulfillmentStatus || trackerSummary?.status || null;
  const trackerDeliveryText = String(trackerSummary?.delivery?.text || '').trim();

  const copyText = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setNotice(successMessage);
    } catch {
      setError('Không thể sao chép tự động. Bạn hãy sao chép thủ công.');
    }
  };

  const buildOrderPayload = () => ({
    quantity: allowsQuantity ? quantity : 1,
  });

  const handleCreateOrder = async (event) => {
    event.preventDefault();

    if (
      !turnstileToken &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setError('Hệ thống đang kiểm tra anti-bot. Vui lòng thử lại sau 1 giây.');
      return;
    }

    if (!selectedProduct) {
      setError('Vui lòng chọn sản phẩm trước khi thanh toán.');
      return;
    }

    setCreatingOrder(true);
    setError('');
    setNotice('');
    setWalletNotice('');

    try {
      const { data } = await api.post(
        '/orders',
        {
          email: String(email || '').trim(),
          product_id: selectedProduct.id,
          bankKey: selectedBankKey,
          ...buildOrderPayload(),
          turnstileToken,
        },
        {
          headers: {
            'x-turnstile-token': turnstileToken,
          },
        },
      );

      setOrderResult(data);
      setOrderStatus('pending');
      setOrderFulfillmentStatus(null);
      setTrackerRef(data.payment_ref || '');
      await fetchOrderSummary(data.payment_ref, { silent: true });
      setNotice('Đã tạo đơn thành công. Vui lòng quét QR và chuyển khoản đúng nội dung.');
      setTurnstileToken(null);
      turnstileRef.current?.reset?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo đơn hàng.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleWalletCheckout = async () => {
    if (!selectedProduct) {
      setError('Vui lòng chọn sản phẩm trước khi thanh toán bằng quỹ.');
      return;
    }

    setWalletLoading(true);
    setError('');
    setNotice('');
    setWalletNotice('');

    try {
      const { data } = await api.post('/wallet/checkout', {
        productId: selectedProduct.id,
        ...buildOrderPayload(),
      });

      await refreshAccount();
      await fetchProducts();
      setOrderStatus('paid');
      setOrderFulfillmentStatus(data?.fulfillmentStatus || null);
      setTrackerRef(data?.paymentRef || '');
      if (data?.paymentRef) {
        await fetchOrderSummary(data.paymentRef, { silent: true });
      }
      setWalletNotice(data?.message || 'Thanh toán bằng quỹ thành công.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể thanh toán bằng quỹ lúc này.');
    } finally {
      setWalletLoading(false);
    }
  };

  const renderPaymentState = () => {
    if (orderStatus !== 'paid') return null;

    const isProcessing = orderFulfillmentStatus === 'processing';

    return (
      <div className="space-y-4">
        <div
          className={`space-y-3 rounded-2xl border p-6 text-center ${
            isProcessing
              ? 'border-cyan-500/20 bg-cyan-500/10'
              : 'border-green-500/20 bg-green-500/10'
          }`}
        >
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              isProcessing ? 'bg-cyan-500/20 text-cyan-300' : 'bg-green-500/20 text-green-400'
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="h-6 w-6 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <h3 className={`text-lg font-bold ${isProcessing ? 'text-cyan-200' : 'text-green-400'}`}>
            {isProcessing ? 'Đã ghi nhận thanh toán' : 'Đã giao mã thành công'}
          </h3>
          <p className={`text-sm ${isProcessing ? 'text-cyan-100/80' : 'text-green-300/80'}`}>
            {isProcessing
              ? 'Đơn hàng đang chờ lấy mã từ nhà cung cấp. Bạn có thể giữ trang mở hoặc tra cứu lại sau.'
              : 'Mã thẻ đã sẵn sàng. Bạn có thể sao chép lại dữ liệu đã giao ngay bên dưới.'}
          </p>
        </div>

        {!isProcessing && trackerDeliveryText && (
          <div className="rounded-2xl border border-green-500/20 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-green-300">Dữ liệu đã giao</p>
              <button
                type="button"
                onClick={() => copyText(trackerDeliveryText, 'Đã sao chép mã thẻ.')}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/75 hover:bg-white/10"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90">
              {trackerDeliveryText}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1480px] space-y-8 px-4 py-10 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-100/80">
            <Link to="/cua-hang" className="hover:text-white">
              Cửa hàng
            </Link>
            <span className="text-white/35">/</span>
            <span>Card và mã số</span>
          </div>
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-black text-white md:text-5xl">
            Card và mã số
            <CreditCard className="h-8 w-8 text-fuchsia-200" />
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
            Chọn nhà mạng hoặc loại thẻ, chọn đúng mệnh giá rồi thanh toán. Sau khi nhà cung cấp
            trả mã, hệ thống sẽ giao ngay trong khung tra cứu đơn hàng.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/cua-hang/dich-vu"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 hover:bg-cyan-400/15"
          >
            Sang khu dịch vụ
          </Link>
          <button
            type="button"
            onClick={fetchProducts}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </div>

      {(error || notice || walletNotice) && (
        <div className="space-y-2">
          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </div>
          )}
          {walletNotice && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-200">
              {walletNotice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_380px] xl:items-start">
        <aside className="glass rounded-[28px] border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(34,10,40,0.94),rgba(15,9,24,0.98))] p-4 shadow-[0_0_42px_rgba(217,70,239,0.08)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Nhà cung cấp</p>
              <p className="mt-1 text-xs text-white/45">
                {providerGroups.length.toLocaleString('vi-VN')} nhóm thẻ
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
              Card
            </div>
          </div>

          <div className="space-y-2">
            {filteredProviders.map((provider) => {
              const active = provider.key === activeProvider?.key;
              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => setSelectedProviderKey(provider.key)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    active
                      ? 'border-fuchsia-400/40 bg-fuchsia-400/12 shadow-[0_0_24px_rgba(217,70,239,0.14)]'
                      : 'border-white/10 bg-white/[0.04] hover:border-fuchsia-400/20 hover:bg-white/[0.07]'
                  }`}
                >
                  <p className="text-sm font-bold text-white">{provider.name}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {provider.items.length.toLocaleString('vi-VN')} mệnh giá
                  </p>
                </button>
              );
            })}

            {!loading && filteredProviders.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Không có nhóm thẻ nào khớp với từ khóa tìm kiếm.
              </div>
            )}
          </div>
        </aside>

        <div className="glass space-y-5 rounded-[28px] p-5 md:p-6">
          <div className="rounded-[24px] border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(22,10,34,0.94),rgba(10,7,17,0.98))] p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fuchsia-100/30" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên thẻ, nhà mạng hoặc mệnh giá..."
                    className="w-full rounded-2xl border border-fuchsia-400/15 bg-[#120a1c] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-400/40 focus:outline-none"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/35">
                  Đang xem
                </p>
                <p className="mt-2 text-sm font-bold text-white">{activeProvider?.name || '-'}</p>
                <p className="mt-1 text-xs text-white/45">
                  {activeProvider?.items?.length
                    ? `${activeProvider.items.length.toLocaleString('vi-VN')} mệnh giá`
                    : 'Chưa có dữ liệu'}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-black/10 px-6 py-16 text-center text-sm text-white/40">
              Đang tải danh sách card...
            </div>
          ) : activeProvider?.items?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeProvider.items.map((product) => {
                const sourceConfig = normalizeSourceConfig(product.sourceConfig);
                const active = Number(product.id) === Number(selectedProductId);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={`group flex min-h-[230px] flex-col rounded-[26px] border p-4 text-left transition-all ${
                      active
                        ? 'border-fuchsia-400/40 bg-[linear-gradient(180deg,rgba(39,14,51,0.96),rgba(18,10,29,0.98))] shadow-[0_0_36px_rgba(217,70,239,0.12)]'
                        : 'border-white/10 bg-[linear-gradient(180deg,rgba(18,10,29,0.96),rgba(10,8,18,0.98))] hover:border-fuchsia-400/20 hover:bg-[linear-gradient(180deg,rgba(28,12,40,0.96),rgba(12,9,21,0.98))]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-400/12 text-sm font-black text-fuchsia-200">
                        {String(sourceConfig.serviceCode || activeProvider.name).slice(0, 2).toUpperCase()}
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                        giao ngay
                      </span>
                    </div>

                    <div className="mt-4 flex-1">
                      <p className="line-clamp-2 text-base font-bold text-white">{product.name}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/50">
                        {sourceConfig.serviceCode || activeProvider.name}
                      </p>
                      <p className="mt-3 line-clamp-3 text-sm text-white/55">
                        {product.description || 'Sản phẩm card số giao ngay sau khi thanh toán thành công.'}
                      </p>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-fuchsia-200">{formatVnd(product.price)}</p>
                        <p className="mt-1 text-[11px] text-white/40">
                          Mệnh giá {getCardValueLabel(product)}
                        </p>
                      </div>
                      <span
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                          active
                            ? 'border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-100'
                            : 'border-white/10 bg-white/[0.03] text-white/70 group-hover:border-fuchsia-400/20 group-hover:text-white'
                        }`}
                      >
                        {active ? 'Đang chọn' : 'Chọn thẻ'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-black/10 px-6 py-16 text-center text-sm text-white/40">
              Không tìm thấy sản phẩm card nào phù hợp.
            </div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <div className="glass space-y-5 rounded-[28px] border border-fuchsia-400/15 bg-[linear-gradient(180deg,rgba(22,10,34,0.96),rgba(11,8,20,0.98))] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Tóm tắt thanh toán</h2>
                <p className="mt-1 text-sm text-white/45">
                  Chọn mệnh giá bên trái, điền email nhận hàng và thanh toán ngay.
                </p>
              </div>
              <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-fuchsia-100/70">
                Card
              </div>
            </div>

            {isAuthenticated ? (
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-secondary/20 bg-secondary/15 p-3 text-secondary">
                    <WalletCards className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-secondary/70">Quỹ nội bộ</p>
                    <p className="mt-1 text-2xl font-black text-white">{formatVnd(walletBalance)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                <p className="font-bold text-white">Bạn vẫn có thể thanh toán bằng QR mà không cần đăng nhập.</p>
                <p className="mt-2">
                  Nếu muốn dùng quỹ nội bộ, hãy{' '}
                  <Link to="/dang-nhap" className="font-bold text-secondary hover:underline">
                    đăng nhập
                  </Link>{' '}
                  hoặc{' '}
                  <Link to="/dang-ky" className="font-bold text-secondary hover:underline">
                    đăng ký
                  </Link>
                  .
                </p>
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Sản phẩm đã chọn
                </label>
                <div className="mt-2 rounded-2xl border border-fuchsia-400/15 bg-[#120a1c] p-4 text-sm shadow-[0_0_24px_rgba(217,70,239,0.05)]">
                  {selectedProduct ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">{selectedProduct.name}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {selectedSourceConfig.serviceCode || activeProvider?.name || '-'} • {getCardValueLabel(selectedProduct)}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
                          <ShieldCheck className="h-3 w-3" />
                          card số
                        </div>
                      </div>
                      <p className="mt-3 font-black text-fuchsia-200">{formatVnd(estimatedAmount)}</p>
                    </div>
                  ) : (
                    <p className="text-white/40">Bạn chưa chọn sản phẩm.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Email nhận hàng
                </label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm focus:border-fuchsia-400 focus:outline-none"
                  />
                </div>
              </div>

              {allowsQuantity && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Số lượng
                  </label>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-fuchsia-400 focus:outline-none"
                    required
                  />
                </div>
              )}

              {hasPaymentChoices && (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Ngân hàng nhận tiền
                  </span>
                  <select
                    value={selectedBankKey}
                    onChange={(e) => setSelectedBankKey(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-fuchsia-400 focus:outline-none"
                  >
                    {paymentAccounts.map((account) => (
                      <option key={account.key} value={account.key}>
                        {account.label || account.accountNo}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="submit"
                disabled={creatingOrder || !selectedProduct}
                className="w-full rounded-xl bg-fuchsia-500 py-3 font-bold text-white hover:bg-fuchsia-500/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingOrder ? 'Đang tạo đơn...' : 'Tạo mã QR thanh toán'}
              </button>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleWalletCheckout}
                  disabled={walletLoading || !canWalletCheckout}
                  className="w-full rounded-xl bg-secondary py-3 font-bold text-background hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {walletLoading
                    ? 'Đang thanh toán bằng quỹ...'
                    : walletBalance < Number(estimatedAmount || 0)
                      ? 'Số dư quỹ không đủ'
                      : 'Thanh toán bằng quỹ'}
                </button>
              )}

              <div className="pointer-events-none absolute h-0 opacity-0">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={
                    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                      ? '1x00000000000000000000AA'
                      : import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'
                  }
                  onSuccess={(token) => setTurnstileToken(token)}
                  options={{ theme: 'dark', size: 'invisible' }}
                />
              </div>
            </form>

            {orderResult?.qr_url && (
              <div className="space-y-3 border-t border-white/10 pt-4">
                {orderStatus === 'paid' ? (
                  renderPaymentState()
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <QrCode className="h-4 w-4 text-fuchsia-300" />
                        Mã QR thanh toán
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-orange-400/10 px-3 py-1.5 text-xs font-semibold text-orange-400">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent"></div>
                        Đang chờ...
                      </div>
                    </div>
                    <img
                      src={orderResult.qr_url}
                      alt="Mã QR thanh toán"
                      className="mx-auto w-full max-w-[280px] rounded-2xl border border-white/10 bg-white p-2"
                    />
                    {orderResult.accountNo && (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                        <p className="mb-1 text-xs text-white/50">Tài khoản nhận tiền</p>
                        <p className="font-semibold text-white">{orderResult.accountName}</p>
                        <p className="mt-1 font-mono text-xs text-white/60">
                          {orderResult.accountNo} - {orderResult.bankBin}
                        </p>
                      </div>
                    )}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <p className="mb-1 text-xs text-white/50">Nội dung chuyển khoản</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-white">
                          {orderResult.transfer_content || orderResult.payment_ref}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              orderResult.transfer_content || orderResult.payment_ref,
                              'Đã sao chép nội dung chuyển khoản.',
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                        >
                          <Copy className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="glass space-y-4 rounded-[28px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Tra cứu đơn hàng</h2>
                <p className="mt-1 text-sm text-white/45">
                  Dùng mã thanh toán để xem lại trạng thái đơn card hoặc sao chép lại dữ liệu đã giao.
                </p>
              </div>
              <Search className="h-5 w-5 text-white/35" />
            </div>

            <div className="flex gap-3">
              <input
                value={trackerRef}
                onChange={(e) => setTrackerRef(e.target.value)}
                placeholder="Nhập mã như ORD..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-fuchsia-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fetchOrderSummary(trackerRef)}
                disabled={trackerLoading || !trackerRef.trim()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/85 hover:bg-white/10 disabled:opacity-60"
              >
                {trackerLoading ? 'Đang tra...' : 'Tra cứu'}
              </button>
            </div>

            {trackerSummary ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <TrackerBadge status={trackerSummary.status} label={`Thanh toán: ${trackerSummary.status}`} />
                  <TrackerBadge
                    status={trackerSummary.fulfillmentStatus}
                    label={`Fulfillment: ${trackerSummary.fulfillmentStatus}`}
                  />
                </div>

                <div>
                  <p className="text-lg font-bold text-white">
                    {trackerSummary.product?.name || 'Đơn card'}
                  </p>
                  <p className="mt-1 text-sm text-white/55">{trackerSummary.email}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Giá trị</p>
                    <p className="mt-2 font-bold text-fuchsia-200">{formatVnd(trackerSummary.amount)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Mã thanh toán</p>
                    <p className="mt-2 font-mono text-sm text-white">{trackerSummary.paymentRef}</p>
                  </div>
                </div>

                {trackerDeliveryText && (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wider text-green-200/80">
                        Dữ liệu đã giao
                      </p>
                      <button
                        type="button"
                        onClick={() => copyText(trackerDeliveryText, 'Đã sao chép mã thẻ.')}
                        className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/75 hover:bg-white/10"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-white">
                      {trackerDeliveryText}
                    </pre>
                  </div>
                )}

                <div className="text-xs text-white/45">
                  {trackerStatus === 'processing'
                    ? 'Đơn đã thanh toán và đang chờ nhà cung cấp trả mã. Bạn có thể quay lại tra cứu sau.'
                    : trackerStatus === 'manual_review'
                      ? 'Đơn đang cần admin xử lý tay. Hệ thống đã giữ thông tin đơn hàng để tiếp tục sau.'
                      : trackerStatus === 'delivered'
                        ? 'Đơn đã giao xong. Bạn có thể sao chép lại dữ liệu đã nhận ở phía trên.'
                        : 'Trạng thái đơn đang được cập nhật.'}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Chưa có dữ liệu tra cứu. Nhập mã thanh toán để xem lại đơn hàng.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceCards;
