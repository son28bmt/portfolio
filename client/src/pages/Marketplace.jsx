import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Mail,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  WalletCards,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const PLATFORM_RULES = [
  { key: 'facebook', label: 'Facebook', keywords: ['facebook', 'fb '] },
  { key: 'instagram', label: 'Instagram', keywords: ['instagram', 'insta'] },
  { key: 'tiktok', label: 'TikTok', keywords: ['tiktok', 'tik tok'] },
  { key: 'youtube', label: 'YouTube', keywords: ['youtube', 'yt '] },
  { key: 'telegram', label: 'Telegram', keywords: ['telegram'] },
  { key: 'threads', label: 'Threads', keywords: ['threads'] },
  { key: 'twitter', label: 'Twitter / X', keywords: ['twitter', 'tweet', 'x buff', 'x comment'] },
  { key: 'google', label: 'Google', keywords: ['google', 'gmb', 'map'] },
  { key: 'shopee', label: 'Shopee', keywords: ['shopee'] },
  { key: 'discord', label: 'Discord', keywords: ['discord'] },
  { key: 'linkedin', label: 'LinkedIn', keywords: ['linkedin'] },
  { key: 'zalo', label: 'Zalo', keywords: ['zalo'] },
];

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const normalizeSourceConfig = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const getCategoryMeta = (product) => {
  const name = String(product?.category?.name || 'Chưa phân loại').trim() || 'Chưa phân loại';
  return { key: name.toLowerCase(), name };
};

const getPlatformMeta = (product) => {
  const sourceConfig = normalizeSourceConfig(product?.sourceConfig);
  const haystack = [
    product?.category?.name,
    sourceConfig?.categoryName,
    product?.name,
    product?.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchedRule = PLATFORM_RULES.find((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword)),
  );

  if (matchedRule) {
    return { key: matchedRule.key, name: matchedRule.label };
  }

  return { key: 'other', name: 'Khác' };
};

const getPlatformMonogram = (name) => {
  const text = String(name || '').trim();
  if (!text) return '?';
  if (text.toLowerCase().includes('twitter')) return 'X';

  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || text[0].toUpperCase();
};

const getPlatformAccent = (platformKey) =>
  (
    {
      facebook: 'border-sky-400/25 bg-sky-500/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.12)]',
      instagram:
        'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200 shadow-[0_0_24px_rgba(217,70,239,0.12)]',
      tiktok: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]',
      youtube: 'border-red-400/25 bg-red-500/10 text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.12)]',
      telegram:
        'border-sky-300/25 bg-sky-400/10 text-sky-100 shadow-[0_0_24px_rgba(125,211,252,0.12)]',
      threads:
        'border-violet-400/25 bg-violet-500/10 text-violet-200 shadow-[0_0_24px_rgba(167,139,250,0.12)]',
      twitter: 'border-blue-400/25 bg-blue-500/10 text-blue-200 shadow-[0_0_24px_rgba(96,165,250,0.12)]',
      google: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.12)]',
      shopee: 'border-orange-400/25 bg-orange-500/10 text-orange-200 shadow-[0_0_24px_rgba(251,146,60,0.12)]',
      discord:
        'border-indigo-400/25 bg-indigo-500/10 text-indigo-200 shadow-[0_0_24px_rgba(129,140,248,0.12)]',
      linkedin:
        'border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.12)]',
      zalo: 'border-blue-300/25 bg-blue-400/10 text-blue-100 shadow-[0_0_24px_rgba(125,211,252,0.12)]',
      other: 'border-white/10 bg-white/5 text-white/85',
    }
  )[platformKey] || 'border-white/10 bg-white/5 text-white/85';

const estimateAmount = ({ product, sourceConfig, quantity }) => {
  const basePrice = Number(product?.price || 0);
  const count = Number(quantity || 0);

  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  if (product?.sourceType !== 'supplier_api' || sourceConfig?.supplierKind !== 'smm_panel') {
    return Math.round(basePrice);
  }
  if (sourceConfig?.pricingModel === 'fixed') return Math.round(basePrice);
  if (sourceConfig?.pricingModel === 'per_unit') return Math.round(basePrice * Math.max(0, count));
  return Math.round((basePrice * Math.max(0, count)) / 1000);
};

const isProductAvailable = (product) =>
  product?.sourceType === 'supplier_api' || Number(product?.quantity || 0) > 0;

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

const Marketplace = ({
  catalogMode = 'all',
  breadcrumbLabel = 'Dịch vụ số',
  pageTitle = 'Dịch vụ số',
  pageDescription = 'Chọn nền tảng, lọc đúng nhóm dịch vụ rồi bấm vào gói bạn muốn mua. Phần cấu hình và thanh toán sẽ hiện ngay ở khung bên phải.',
  alternateLink = '/cua-hang/card',
  alternateLabel = 'Khu card',
}) => {
  const { isAuthenticated, account, refreshAccount } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [walletNotice, setWalletNotice] = useState('');

  const [selectedPlatformKey, setSelectedPlatformKey] = useState('');
  const [selectedSubgroupKey, setSelectedSubgroupKey] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedBankKey, setSelectedBankKey] = useState('');

  const [email, setEmail] = useState('');
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [comments, setComments] = useState('');
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
  const paymentSectionRef = useRef();
  const quantityInputRef = useRef();
  const emailInputRef = useRef();
  const shouldScrollToCheckoutRef = useRef(false);

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

  const catalogProducts = useMemo(() => {
    if (catalogMode === 'supplier') {
      return products.filter((item) => item?.sourceType === 'supplier_api');
    }

    if (catalogMode === 'local') {
      return products.filter((item) => item?.sourceType !== 'supplier_api');
    }

    return products;
  }, [catalogMode, products]);

  useEffect(() => {
    let sse;
    const paymentRef = orderResult?.payment_ref;
    const shouldTrackSupplierProgress =
      paymentRef &&
      (orderStatus === 'pending' ||
        (orderStatus === 'paid' && orderFulfillmentStatus === 'processing'));

    if (shouldTrackSupplierProgress) {
      const baseUrl = api.defaults.baseURL || 'https://api.nguyenquangson.id.vn/api';
      sse = new EventSource(`${baseUrl}/sse/orders/${paymentRef}`);

      sse.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'paid') {
            const nextFulfillmentStatus =
              data.fulfillmentStatus || orderFulfillmentStatus || 'delivered';
            setOrderStatus('paid');
            setOrderFulfillmentStatus(nextFulfillmentStatus);
            await fetchOrderSummary(paymentRef, { silent: true });
            await fetchProducts();
            if (nextFulfillmentStatus !== 'processing') {
              sse.close();
            }
          }
        } catch {
          // Ignore malformed event payload
        }
      };
    }

    return () => {
      if (sse) sse.close();
    };
  }, [orderFulfillmentStatus, orderResult, orderStatus]);

  const platformGroups = useMemo(() => {
    const groups = new Map();

    catalogProducts.forEach((item) => {
      const platform = getPlatformMeta(item);
      const category = getCategoryMeta(item);

      if (!groups.has(platform.key)) {
        groups.set(platform.key, {
          key: platform.key,
          name: platform.name,
          count: 0,
          items: [],
          categories: new Map(),
        });
      }

      const group = groups.get(platform.key);
      group.count += 1;
      group.items.push(item);

      if (!group.categories.has(category.key)) {
        group.categories.set(category.key, { key: category.key, name: category.name, count: 0 });
      }
      group.categories.get(category.key).count += 1;
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        categories: Array.from(group.categories.values()).sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name, 'vi');
        }),
      }))
      .sort((a, b) => {
        const aIndex = PLATFORM_RULES.findIndex((rule) => rule.key === a.key);
        const bIndex = PLATFORM_RULES.findIndex((rule) => rule.key === b.key);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [catalogProducts]);

  useEffect(() => {
    if (!platformGroups.length) return;

    if (!selectedPlatformKey) {
      setSelectedPlatformKey(platformGroups[0].key);
      setSelectedSubgroupKey('all');
      return;
    }

    const stillExists = platformGroups.some((group) => group.key === selectedPlatformKey);
    if (!stillExists) {
      setSelectedPlatformKey(platformGroups[0].key);
      setSelectedSubgroupKey('all');
      setServiceSearch('');
    }
  }, [platformGroups, selectedPlatformKey]);

  const activePlatform = useMemo(() => {
    if (!platformGroups.length) return null;
    if (!selectedPlatformKey) return null;
    return platformGroups.find((group) => group.key === selectedPlatformKey) || null;
  }, [platformGroups, selectedPlatformKey]);

  useEffect(() => {
    if (!activePlatform) return;

    const stillExists =
      selectedSubgroupKey === 'all' ||
      activePlatform.categories.some((category) => category.key === selectedSubgroupKey);

    if (!stillExists) {
      setSelectedSubgroupKey('all');
    }
  }, [activePlatform, selectedSubgroupKey]);

  const activeSubgroup = useMemo(() => {
    if (!activePlatform || selectedSubgroupKey === 'all') return null;
    return activePlatform.categories.find((category) => category.key === selectedSubgroupKey) || null;
  }, [activePlatform, selectedSubgroupKey]);

  const filteredGroupItems = useMemo(() => {
    let items = activePlatform?.items || [];

    if (selectedSubgroupKey !== 'all') {
      items = items.filter((product) => getCategoryMeta(product).key === selectedSubgroupKey);
    }

    const keyword = String(serviceSearch || '').trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((product) => {
      const haystack = [
        product?.name,
        product?.description,
        product?.category?.name,
        normalizeSourceConfig(product?.sourceConfig)?.categoryName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [activePlatform, selectedSubgroupKey, serviceSearch]);

  useEffect(() => {
    if (!filteredGroupItems.length) {
      setSelectedProductId(null);
      return;
    }

    const exists = filteredGroupItems.some((item) => Number(item.id) === Number(selectedProductId));
    if (!exists) {
      setSelectedProductId(filteredGroupItems[0].id);
    }
  }, [filteredGroupItems, selectedProductId]);

  const selectedProduct = useMemo(
    () => catalogProducts.find((item) => Number(item.id) === Number(selectedProductId)) || null,
    [catalogProducts, selectedProductId],
  );

  const selectedSourceConfig = useMemo(
    () => normalizeSourceConfig(selectedProduct?.sourceConfig),
    [selectedProduct],
  );

  const isSupplierPanel =
    selectedProduct?.sourceType === 'supplier_api' &&
    selectedSourceConfig?.supplierKind === 'smm_panel';

  useEffect(() => {
    if (!shouldScrollToCheckoutRef.current || !selectedProductId) return;

    const timer = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const focusTarget = quantityInputRef.current || emailInputRef.current;
      focusTarget?.focus?.();
      shouldScrollToCheckoutRef.current = false;
    }, 140);

    return () => window.clearTimeout(timer);
  }, [isSupplierPanel, selectedProductId]);

  useEffect(() => {
    if (!selectedProduct) {
      setTargetLink('');
      setQuantity('');
      setComments('');
      return;
    }

    if (isSupplierPanel) {
      setQuantity(
        selectedSourceConfig.defaultQuantity
          ? String(selectedSourceConfig.defaultQuantity)
          : selectedSourceConfig.minQuantity
            ? String(selectedSourceConfig.minQuantity)
            : '',
      );
      if (!selectedSourceConfig.requiresComments) {
        setComments('');
      }
    } else {
      setTargetLink('');
      setQuantity('');
      setComments('');
    }
  }, [isSupplierPanel, selectedProduct, selectedSourceConfig]);

  const walletBalance = Number(account?.wallet?.balance || 0);
  const estimatedAmount = useMemo(
    () =>
      estimateAmount({
        product: selectedProduct,
        sourceConfig: selectedSourceConfig,
        quantity,
      }),
    [quantity, selectedProduct, selectedSourceConfig],
  );

  const canWalletCheckout =
    isAuthenticated &&
    selectedProduct &&
    isProductAvailable(selectedProduct) &&
    walletBalance >= Number(estimatedAmount || selectedProduct.price || 0);

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

  const handleSelectProduct = (productId) => {
    shouldScrollToCheckoutRef.current = window.innerWidth < 1280;
    setSelectedProductId(productId);
  };

  const buildOrderPayload = () => ({
    targetLink,
    quantity,
    comments,
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
      setNotice('Đã tạo đơn thành công. Vui lòng chuyển khoản đúng nội dung để hệ thống xử lý.');
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
            {isProcessing ? 'Đã ghi nhận thanh toán' : 'Thanh toán thành công'}
          </h3>
          <p className={`text-sm ${isProcessing ? 'text-cyan-100/80' : 'text-green-300/80'}`}>
            {isProcessing
              ? 'Đơn hàng đang được xử lý qua supplier. Bạn có thể theo dõi lại bằng mã thanh toán ở khung tra cứu đơn.'
              : 'Đơn hàng đã được xác nhận hoàn tất hoặc đã giao xong.'}
          </p>
        </div>

        {!isProcessing && trackerDeliveryText && (
          <div className="rounded-2xl border border-green-500/20 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-green-300">Sản phẩm đã giao</p>
              <button
                type="button"
                onClick={() => copyText(trackerDeliveryText, 'Đã sao chép thông tin sản phẩm.')}
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
    <div className="mx-auto max-w-[1560px] space-y-8 px-4 py-10 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/80">
            <Link to="/cua-hang" className="hover:text-white">
              Cửa hàng
            </Link>
            <span className="text-white/35">/</span>
            <span>{breadcrumbLabel}</span>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black md:text-5xl">
            {pageTitle}
            <ShoppingBag className="h-8 w-8 text-primary" />
          </h1>
          <p className="mt-2 max-w-3xl text-white/60">
            {pageDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={alternateLink}
            className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2.5 text-sm font-bold text-fuchsia-100/85 hover:bg-fuchsia-400/15"
          >
            {alternateLabel}
          </Link>
          <button
            type="button"
            onClick={fetchProducts}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới sản phẩm
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

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 glass space-y-5 rounded-[28px] p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Danh sách sản phẩm</h2>
            <p className="text-xs text-white/50">
              {loading ? 'Đang tải...' : `${catalogProducts.length.toLocaleString('vi-VN')} sản phẩm`}
            </p>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-white/40">Đang tải sản phẩm...</div>
          ) : catalogProducts.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/40">
              Hiện chưa có sản phẩm nào đang mở bán.
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(7,25,44,0.96),rgba(8,15,29,0.96))] p-4 shadow-[0_0_32px_rgba(34,211,238,0.08)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Platforms</p>
                    <p className="mt-1 text-xs text-white/40">
                      {platformGroups.length.toLocaleString('vi-VN')} nền tảng
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                    Live
                  </div>
                </div>

                <div className="flex max-h-[680px] flex-col gap-2 overflow-y-auto pr-1">
                  {platformGroups.map((platform) => {
                    const isActive = activePlatform?.key === platform.key;

                    return (
                      <button
                        key={platform.key}
                        type="button"
                        onClick={() => {
                          setSelectedPlatformKey(platform.key);
                          setSelectedSubgroupKey('all');
                          setServiceSearch('');
                        }}
                        className={`group rounded-2xl border px-3 py-3 text-left transition-all ${
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-400/12 shadow-[0_0_24px_rgba(56,189,248,0.12)]'
                            : 'border-white/10 bg-white/[0.04] hover:border-cyan-400/20 hover:bg-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${getPlatformAccent(platform.key)}`}
                          >
                            {getPlatformMonogram(platform.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{platform.name}</p>
                            <p className="mt-1 text-xs text-white/45">
                              {platform.count.toLocaleString('vi-VN')} dịch vụ
                            </p>
                          </div>
                          <ArrowRight
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              isActive ? 'translate-x-1 text-cyan-200' : 'text-white/35 group-hover:text-white/70'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="min-w-0 space-y-4">
                <div className="rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(6,16,31,0.96),rgba(4,10,21,0.98))] p-4 shadow-[0_0_32px_rgba(34,211,238,0.06)]">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-100/30" />
                        <input
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          placeholder="Search for services..."
                          className="w-full rounded-2xl border border-cyan-500/15 bg-[#081221] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:border-cyan-400/40 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/35">
                        Đang xem
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">{activePlatform?.name || '-'}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {activeSubgroup ? activeSubgroup.name : 'Tất cả danh mục'}
                      </p>
                    </div>
                  </div>

                  {activePlatform?.categories?.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSubgroupKey('all')}
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                          selectedSubgroupKey === 'all'
                            ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                            : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                        }`}
                      >
                        All
                      </button>
                      {activePlatform.categories.map((category) => (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => setSelectedSubgroupKey(category.key)}
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                            selectedSubgroupKey === category.key
                              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                              : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
                          }`}
                        >
                          {category.name} ({category.count.toLocaleString('vi-VN')})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredGroupItems.length > 0 ? (
                    filteredGroupItems.map((product) => {
                      const active = Number(product.id) === Number(selectedProductId);
                      const available = isProductAvailable(product);
                      const sourceConfig = normalizeSourceConfig(product.sourceConfig);
                      const category = getCategoryMeta(product);
                      const platformMeta = getPlatformMeta(product);

                      return (
                        <motion.button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product.id)}
                          whileHover={{ y: available ? -4 : 0 }}
                          className={`group flex min-h-[252px] flex-col rounded-[26px] border p-4 text-left transition-all ${
                            active
                              ? 'border-cyan-400/40 bg-[linear-gradient(180deg,rgba(8,28,48,0.96),rgba(10,18,34,0.98))] shadow-[0_0_36px_rgba(34,211,238,0.12)]'
                              : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(7,12,24,0.96))] hover:border-cyan-400/20 hover:bg-[linear-gradient(180deg,rgba(8,24,43,0.94),rgba(8,16,31,0.98))]'
                          } ${!available ? 'opacity-55 saturate-50' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${getPlatformAccent(platformMeta.key)}`}
                            >
                              {getPlatformMonogram(platformMeta.name)}
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                              {product.sourceType === 'supplier_api'
                                ? sourceConfig.supplierKind || 'supplier'
                                : 'local'}
                            </span>
                          </div>

                          <div className="mt-4 flex-1">
                            <p className="line-clamp-2 text-base font-bold text-white">{product.name}</p>
                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                              {category.name}
                            </p>
                            <p className="mt-3 line-clamp-3 text-sm text-white/55">
                              {product.description || 'Không có mô tả chi tiết cho dịch vụ này.'}
                            </p>
                          </div>

                          <div className="mt-5 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-lg font-black text-cyan-200">{formatVnd(product.price)}</p>
                              <p className="mt-1 text-[11px] text-white/40">
                                {product.sourceType === 'supplier_api'
                                  ? 'Async supplier'
                                  : available
                                    ? `Còn ${Number(product.quantity).toLocaleString('vi-VN')}`
                                    : 'Hết hàng'}
                              </p>
                            </div>
                            <span
                              className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                                active
                                  ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                                  : 'border-white/10 bg-white/[0.03] text-white/70 group-hover:border-cyan-400/20 group-hover:text-white'
                              }`}
                            >
                              {active ? 'Đang chọn' : 'Chọn dịch vụ'}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })
                  ) : (
                    <div className="sm:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-white/10 bg-black/10 px-6 py-16 text-center text-sm text-white/40">
                      Không tìm thấy dịch vụ nào trong nền tảng đang chọn.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:w-[380px] xl:shrink-0">
          <div
            ref={paymentSectionRef}
            className="glass space-y-5 rounded-[28px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(8,16,32,0.96),rgba(5,10,20,0.98))] p-5 shadow-[0_0_36px_rgba(34,211,238,0.08)] md:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Checkout Summary</h2>
                <p className="mt-1 text-sm text-white/45">
                  Chọn dịch vụ bên trái, cấu hình đơn ở đây và thanh toán ngay.
                </p>
              </div>
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/70">
                Live
              </div>
            </div>

            {isAuthenticated ? (
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-secondary/20 bg-secondary/15 p-3 text-secondary">
                    <WalletCards className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-secondary/70">
                      Quỹ nội bộ
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">{formatVnd(walletBalance)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                <p className="font-bold text-white">Guest checkout vẫn là mặc định.</p>
                <p className="mt-2">
                  Nếu muốn nạp quỹ và nhận ưu đãi, bạn có thể{' '}
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
                <div className="mt-2 rounded-2xl border border-cyan-500/15 bg-[#081221] p-4 text-sm shadow-[0_0_24px_rgba(34,211,238,0.05)]">
                  {selectedProduct ? (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold">{selectedProduct.name}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {activePlatform?.name || '-'}
                            {activeSubgroup ? ` • ${activeSubgroup.name}` : ''}
                          </p>
                        </div>
                        {isSupplierPanel && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                            async supplier
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-black text-primary">
                        {formatVnd(estimatedAmount || selectedProduct.price)}
                      </p>
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {isSupplierPanel && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                      {selectedSourceConfig.targetLabel || 'Link mục tiêu'}
                    </label>
                    <input
                      value={targetLink}
                      onChange={(e) => setTargetLink(e.target.value)}
                      placeholder="https://..."
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                      required={selectedSourceConfig.requiresTargetLink !== false}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Số lượng
                    </label>
                    <input
                      ref={quantityInputRef}
                      type="number"
                      value={quantity}
                      min={selectedSourceConfig.minQuantity || 1}
                      max={selectedSourceConfig.maxQuantity || undefined}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                      required
                    />
                  </div>

                  {selectedSourceConfig.requiresComments && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                        {selectedSourceConfig.commentsLabel || 'Nội dung comments'}
                      </label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="mt-2 min-h-[100px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
                        placeholder="Mỗi dòng một comment nếu dịch vụ yêu cầu"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {hasPaymentChoices && (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Ngân hàng nhận tiền
                  </span>
                  <select
                    value={selectedBankKey}
                    onChange={(e) => setSelectedBankKey(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
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
                disabled={creatingOrder || !selectedProduct || !isProductAvailable(selectedProduct)}
                className="w-full rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingOrder
                  ? 'Đang tạo đơn...'
                  : !isProductAvailable(selectedProduct)
                    ? 'Hết hàng'
                    : 'Tạo mã QR thanh toán'}
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
                    : walletBalance < Number(estimatedAmount || selectedProduct?.price || 0)
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
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <QrCode className="h-4 w-4 text-primary" />
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
                        <span className="font-mono">
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
                          <Copy className="h-4 w-4" />
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
                  Dùng `payment_ref` để xem lại đơn guest hoặc theo dõi đơn supplier đang xử lý.
                </p>
              </div>
              <Search className="h-5 w-5 text-white/35" />
            </div>

            <div className="flex gap-3">
              <input
                value={trackerRef}
                onChange={(e) => setTrackerRef(e.target.value)}
                placeholder="Nhập mã như ORD..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
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
                  <TrackerBadge
                    status={trackerSummary.status}
                    label={`Thanh toán: ${trackerSummary.status}`}
                  />
                  <TrackerBadge
                    status={trackerSummary.fulfillmentStatus}
                    label={`Fulfillment: ${trackerSummary.fulfillmentStatus}`}
                  />
                </div>

                <div>
                  <p className="text-lg font-bold text-white">
                    {trackerSummary.product?.name || 'Đơn hàng'}
                  </p>
                  <p className="mt-1 text-sm text-white/55">{trackerSummary.email}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">Giá trị</p>
                    <p className="mt-2 font-bold text-primary">{formatVnd(trackerSummary.amount)}</p>
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
                        onClick={() =>
                          copyText(trackerDeliveryText, 'Đã sao chép thông tin sản phẩm.')
                        }
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

                {trackerSummary.supplier && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                    <p className="text-xs uppercase tracking-wider text-cyan-100/70">
                      Supplier async
                    </p>
                    <p className="mt-2 text-sm text-cyan-100">
                      External status:{' '}
                      <span className="font-bold">
                        {trackerSummary.supplier.externalStatus || '-'}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-cyan-100/70">
                      External order: {trackerSummary.supplier.externalOrderId || 'chưa có'}
                    </p>
                  </div>
                )}

                <div className="text-xs text-white/45">
                  {trackerStatus === 'processing'
                    ? 'Đơn đang được supplier xử lý. Bạn có thể quay lại tra cứu sau hoặc giữ trang mở để nhận cập nhật.'
                    : trackerStatus === 'manual_review'
                      ? 'Đơn đã được đưa vào manual review. Admin sẽ kiểm tra và xử lý tiếp.'
                      : trackerStatus === 'delivered'
                        ? 'Đơn đã hoàn tất.'
                        : 'Trạng thái đơn đang được cập nhật.'}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                Chưa có dữ liệu tra cứu. Nhập `payment_ref` để xem lại trạng thái đơn hàng.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
