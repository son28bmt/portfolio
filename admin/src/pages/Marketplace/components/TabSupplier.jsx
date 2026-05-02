import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CreditCard,
  Database,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const normalizeSmmServices = (items) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    service: String(item?.service || '').trim(),
    name: String(item?.name || '').trim(),
    category: String(item?.category || '').trim(),
    type: String(item?.type || '').trim(),
    rate: Number(item?.rate || 0),
    min: Number(item?.min || 0),
    max: Number(item?.max || 0),
  }));

const normalizeCardProducts = (items) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    name: String(item?.name || '').trim(),
    serviceCode: String(item?.serviceCode || '').trim(),
    slug: String(item?.slug || '').trim(),
    values: Array.isArray(item?.cardvalue)
      ? item.cardvalue
          .map((subItem) => ({
            id: subItem?.providerProductId ?? subItem?.id ?? null,
            serviceCode: String(subItem?.serviceCode || subItem?.service_code || item?.serviceCode || '').trim(),
            value: Number(subItem?.value || 0),
          }))
          .filter((subItem) => subItem.value > 0)
      : [],
  }));

const initialSmmSyncForm = {
  rateMultiplier: '1',
  markupPercent: '0',
  markupFixed: '0',
  pricingModel: 'per_1000',
  updateExisting: true,
};

const initialCardSyncForm = {
  rateMultiplier: '1',
  markupPercent: '0',
  markupFixed: '0',
  updateExisting: true,
};

const fulfillmentOptions = [
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'manual_review', label: 'Cần kiểm tra tay' },
  { value: 'delivered', label: 'Đã hoàn tất' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'all', label: 'Tất cả' },
];

const pricingOptions = [
  { value: 'fixed', label: 'Giá cố định / đơn' },
  { value: 'per_1000', label: 'Giá theo 1.000 đơn vị' },
  { value: 'per_unit', label: 'Giá theo từng đơn vị' },
];

const isSupplierBalanceLow = (item) =>
  String(item?.fulfillmentPayload?.code || '').trim().toLowerCase() === 'supplier_balance_low';

const TabSupplier = ({ setError, setNotice, refreshKey }) => {
  const [smmServices, setSmmServices] = useState([]);
  const [cardProducts, setCardProducts] = useState([]);
  const [dbCardProducts, setDbCardProducts] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [smmBalanceInfo, setSmmBalanceInfo] = useState(null);
  const [cardBalanceInfo, setCardBalanceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [syncingSmm, setSyncingSmm] = useState(false);
  const [syncingCard, setSyncingCard] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [smmSearch, setSmmSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState({
    fulfillmentStatus: 'processing',
    email: '',
  });
  const [smmSyncForm, setSmmSyncForm] = useState(initialSmmSyncForm);
  const [cardSyncForm, setCardSyncForm] = useState(initialCardSyncForm);

  const fetchSupplierData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const [smmServicesRes, smmBalanceRes, ordersRes, cardProductsRes, cardBalanceRes, dbProductsRes] =
        await Promise.allSettled([
          api.get('/admin/supplier/smm-panel/services'),
          api.get('/admin/supplier/smm-panel/balance'),
          api.get('/admin/orders', {
            params: {
              sourceType: 'supplier_api',
              fulfillmentStatus: queueFilter.fulfillmentStatus,
              email: queueFilter.email,
              page: 1,
              limit: 30,
            },
          }),
          api.get('/admin/supplier/card-partner/products'),
          api.get('/admin/supplier/card-partner/balance'),
          api.get('/admin/products'),
        ]);

      if (smmServicesRes.status === 'fulfilled') {
        setSmmServices(normalizeSmmServices(smmServicesRes.value.data?.items));
      }
      if (smmBalanceRes.status === 'fulfilled') {
        setSmmBalanceInfo(smmBalanceRes.value.data || null);
      }
      if (ordersRes.status === 'fulfilled') {
        setSupplierOrders(Array.isArray(ordersRes.value.data?.items) ? ordersRes.value.data.items : []);
      }
      if (cardProductsRes.status === 'fulfilled') {
        setCardProducts(normalizeCardProducts(cardProductsRes.value.data?.items));
      }
      if (cardBalanceRes.status === 'fulfilled') {
        setCardBalanceInfo(cardBalanceRes.value.data || null);
      }
      if (dbProductsRes.status === 'fulfilled') {
        const allProducts = Array.isArray(dbProductsRes.value.data) ? dbProductsRes.value.data : [];
        setDbCardProducts(allProducts.filter(p => 
          p.sourceType === 'supplier_api' && 
          (p.sourceConfig?.cardProviderCode === 'card_partner' || p.sourceConfig?.supplierKind === 'digital_code')
        ));
      }

      const failures = [smmServicesRes, smmBalanceRes, ordersRes, cardProductsRes, cardBalanceRes].filter(
        (item) => item.status === 'rejected',
      );

      if (failures.length > 0 && !silent) {
        setError('Một vài nguồn dữ liệu nhà cung cấp chưa tải được. Bạn có thể kiểm tra lại cấu hình từng provider.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData({ silent: true });
  }, [refreshKey, queueFilter.fulfillmentStatus, queueFilter.email]);

  const filteredSmmServices = useMemo(() => {
    const query = smmSearch.trim().toLowerCase();
    if (!query) return smmServices;

    return smmServices.filter((item) =>
      `${item.service} ${item.name} ${item.category} ${item.type}`.toLowerCase().includes(query),
    );
  }, [smmSearch, smmServices]);

  const filteredCardProducts = useMemo(() => {
    const query = cardSearch.trim().toLowerCase();
    if (!query) return cardProducts;

    return cardProducts.filter((item) => {
      const valuesText = item.values.map((subItem) => subItem.value).join(' ');
      return `${item.name} ${item.serviceCode} ${item.slug} ${valuesText}`
        .toLowerCase()
        .includes(query);
    });
  }, [cardProducts, cardSearch]);

  const supplierBalanceLowOrders = useMemo(
    () => supplierOrders.filter((item) => isSupplierBalanceLow(item)),
    [supplierOrders],
  );

  const cardValueCount = useMemo(
    () => filteredCardProducts.reduce((total, item) => total + item.values.length, 0),
    [filteredCardProducts],
  );

  const syncSmmServices = async (serviceIds, label = 'các dịch vụ đã chọn') => {
    if (!serviceIds.length) {
      setError('Không có dịch vụ nào để đồng bộ.');
      return;
    }

    setSyncingSmm(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.post('/admin/supplier/smm-panel/sync-services', {
        serviceIds,
        pricingModel: smmSyncForm.pricingModel,
        rateMultiplier: Number(smmSyncForm.rateMultiplier || 1),
        markupPercent: Number(smmSyncForm.markupPercent || 0),
        markupFixed: Number(smmSyncForm.markupFixed || 0),
        updateExisting: smmSyncForm.updateExisting,
      });

      setNotice(
        `Đã đồng bộ ${label}: tạo ${data.created || 0}, cập nhật ${data.updated || 0}, bỏ qua ${data.skipped || 0}.`,
      );
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể đồng bộ dịch vụ từ SMM panel.');
    } finally {
      setSyncingSmm(false);
    }
  };

  const syncCardCatalog = async () => {
    setSyncingCard(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.post('/admin/supplier/card-partner/sync-products', {
        rateMultiplier: Number(cardSyncForm.rateMultiplier || 1),
        markupPercent: Number(cardSyncForm.markupPercent || 0),
        markupFixed: Number(cardSyncForm.markupFixed || 0),
        updateExisting: cardSyncForm.updateExisting,
      });

      setNotice(
        `Đã đồng bộ catalog card: tạo ${data.created || 0}, cập nhật ${data.updated || 0}, bỏ qua ${data.skipped || 0}.`,
      );
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể đồng bộ catalog card.');
    } finally {
      setSyncingCard(false);
    }
  };

  const deleteAllCardProducts = async () => {
    if (!window.confirm('CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ sản phẩm Card đã đồng bộ? Thao tác này không thể hoàn tác.')) return;

    setDeletingCard(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.delete('/admin/supplier/card-partner/products');
      setNotice(data.message || 'Đã xóa toàn bộ sản phẩm card.');
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa sản phẩm card.');
    } finally {
      setDeletingCard(false);
    }
  };

  const deleteSingleProduct = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;

    setError('');
    setNotice('');

    try {
      await api.delete(`/admin/products/${product.id}`);
      setNotice(`Đã xóa "${product.name}".`);
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa sản phẩm.');
    }
  };

  const editProductPrice = async (product) => {
    const nextPrice = window.prompt(`Nhập giá bán mới cho "${product.name}" (VND)`, product.price);
    if (nextPrice === null) return;

    setError('');
    setNotice('');

    try {
      await api.put(`/admin/products/${product.id}`, { price: nextPrice });
      setNotice(`Đã cập nhật giá cho "${product.name}".`);
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật giá.');
    }
  };

  const batchRefreshQueue = async () => {
    setQueueRefreshing(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.post('/admin/supplier/smm-panel/refresh-processing', {
        limit: 20,
        minAgeMs: 10000,
      });

      setNotice(
        `Đã quét hàng đợi nhà cung cấp: ${data.changed || 0} đơn đổi trạng thái, ${data.manualReview || 0} đơn cần kiểm tra tay.`,
      );
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể quét hàng đợi nhà cung cấp.');
    } finally {
      setQueueRefreshing(false);
    }
  };

  const refreshOrder = async (orderId) => {
    setError('');
    setNotice('');

    try {
      await api.post(`/admin/orders/${orderId}/refresh-fulfillment`);
      setNotice(`Đã làm mới đơn nhà cung cấp #${orderId}.`);
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể làm mới đơn nhà cung cấp.');
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 space-y-6 duration-300">
      <div className="glass space-y-5 rounded-[24px] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Trung tâm nhà cung cấp</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/45">
              Khu này dùng để xem số dư provider, đồng bộ catalog vào cửa hàng và theo dõi các đơn
              đang đi qua nhà cung cấp.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchSupplierData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Làm mới dữ liệu
            </button>

            <button
              type="button"
              onClick={batchRefreshQueue}
              disabled={queueRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <RotateCcw className={`h-4 w-4 ${queueRefreshing ? 'animate-spin' : ''}`} />
              Quét lại đơn đang xử lý
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-200">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Số dư SMM</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {smmBalanceInfo ? formatVnd(smmBalanceInfo.balance) : 'Chưa tải'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-fuchsia-200">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Số dư card</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {cardBalanceInfo ? formatVnd(cardBalanceInfo.balance) : 'Chưa tải'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-secondary">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Đang xử lý</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {supplierOrders.filter((item) => item.fulfillmentStatus === 'processing').length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-orange-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Cần kiểm tra tay</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {supplierOrders.filter((item) => item.fulfillmentStatus === 'manual_review').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {supplierBalanceLowOrders.length > 0 && (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-orange-200">Có đơn đang thiếu tiền ở ví nhà cung cấp</p>
                <p className="mt-1 text-sm text-orange-100/80">
                  Đã có {supplierBalanceLowOrders.length} đơn thu tiền thành công nhưng chưa đẩy được sang
                  provider. Hãy nạp thêm tiền rồi bấm <span className="font-bold">Làm mới</span> cho từng đơn.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="glass space-y-4 rounded-[24px] p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-bold">Đơn đi qua nhà cung cấp</h3>
              <p className="mt-1 text-sm text-white/45">
                Theo dõi các đơn đang chạy và xử lý nhanh những đơn cần kiểm tra tay.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={queueFilter.email}
                onChange={(e) => setQueueFilter((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Lọc theo email khách"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />

              <select
                value={queueFilter.fulfillmentStatus}
                onChange={(e) =>
                  setQueueFilter((prev) => ({ ...prev, fulfillmentStatus: e.target.value }))
                }
                className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-primary"
              >
                {fulfillmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-white/60">
                <tr>
                  <th className="px-4 py-3 font-semibold">Đơn</th>
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái ngoài</th>
                  <th className="px-4 py-3 font-semibold">Xử lý nội bộ</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {supplierOrders.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">#{item.id}</div>
                      <div className="mt-1 text-xs text-white/45">{item.email}</div>
                    </td>
                    <td className="px-4 py-3 text-white/85">
                      <div>{item.product?.name || '-'}</div>
                      <div className="mt-1 text-xs text-white/45">{formatVnd(item.amount)}</div>
                      {isSupplierBalanceLow(item) && (
                        <div className="mt-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-[11px] leading-5 text-orange-200">
                          <div className="font-bold">Thiếu tiền supplier</div>
                          <div className="mt-1">
                            Đơn đã thu tiền. Hãy nạp thêm tiền vào provider rồi bấm <span className="font-bold">Làm mới</span>.
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <div>{item.fulfillmentPayload?.externalStatus || '-'}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">
                        {item.fulfillmentPayload?.externalOrderId || 'Chưa có mã ngoài'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            item.fulfillmentStatus === 'manual_review'
                              ? 'bg-orange-500/10 text-orange-300'
                              : item.fulfillmentStatus === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : item.fulfillmentStatus === 'failed'
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'bg-white/10 text-white/75'
                          }`}
                        >
                          {item.fulfillmentStatus || '-'}
                        </span>
                        {item.fulfillmentPayload?.lastError && (
                          <div className="text-[11px] leading-5 text-white/50">
                            {item.fulfillmentPayload.lastError}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => refreshOrder(item.id)}
                        className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white"
                      >
                        Làm mới
                      </button>
                    </td>
                  </tr>
                ))}

                {supplierOrders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-white/40">
                      Không có đơn nhà cung cấp nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="glass space-y-4 rounded-[24px] p-6">
            <div>
              <h3 className="text-lg font-bold">Đồng bộ dịch vụ từ SMM panel</h3>
              <p className="mt-1 text-sm text-white/45">
                Chọn cách tính giá bán, mức cộng lời rồi nhập các dịch vụ social cần bán vào cửa hàng.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                value={smmSyncForm.rateMultiplier}
                onChange={(e) => setSmmSyncForm((prev) => ({ ...prev, rateMultiplier: e.target.value }))}
                placeholder="Hệ số giá vốn"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                step="0.01"
                value={smmSyncForm.markupPercent}
                onChange={(e) => setSmmSyncForm((prev) => ({ ...prev, markupPercent: e.target.value }))}
                placeholder="Cộng lời theo %"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                value={smmSyncForm.markupFixed}
                onChange={(e) => setSmmSyncForm((prev) => ({ ...prev, markupFixed: e.target.value }))}
                placeholder="Cộng thêm cố định"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <select
                value={smmSyncForm.pricingModel}
                onChange={(e) => setSmmSyncForm((prev) => ({ ...prev, pricingModel: e.target.value }))}
                className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-primary"
              >
                {pricingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={smmSyncForm.updateExisting}
                onChange={(e) => setSmmSyncForm((prev) => ({ ...prev, updateExisting: e.target.checked }))}
              />
              Cập nhật lại cả những sản phẩm đã nhập trước đó
            </label>

            <input
              value={smmSearch}
              onChange={(e) => setSmmSearch(e.target.value)}
              placeholder="Tìm theo mã dịch vụ, tên dịch vụ hoặc danh mục..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
            />

            <button
              type="button"
              onClick={() =>
                syncSmmServices(
                  filteredSmmServices.map((item) => item.service),
                  `${filteredSmmServices.length.toLocaleString('vi-VN')} dịch vụ đang lọc`,
                )
              }
              disabled={syncingSmm || filteredSmmServices.length === 0}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {syncingSmm ? 'Đang đồng bộ dịch vụ...' : 'Đồng bộ toàn bộ kết quả đang lọc'}
            </button>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
              {filteredSmmServices.slice(0, 20).map((item) => (
                <div key={item.service} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{item.name || `Dịch vụ ${item.service}`}</p>
                      <p className="mt-1 text-xs text-white/45">
                        #{item.service} • {item.category || 'SMM Panel'}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {formatVnd(item.rate)} • {Number(item.min || 0).toLocaleString('vi-VN')} -{' '}
                        {Number(item.max || 0).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => syncSmmServices([item.service], `dịch vụ ${item.service}`)}
                      disabled={syncingSmm}
                      className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-60"
                    >
                      Đồng bộ
                    </button>
                  </div>
                </div>
              ))}

              {filteredSmmServices.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-white/40">
                  Không có dịch vụ SMM nào khớp với bộ lọc.
                </div>
              )}
            </div>
          </section>

          <section className="glass space-y-4 rounded-[24px] p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-3 text-fuchsia-200">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Đồng bộ catalog card</h3>
                  <p className="mt-1 text-sm text-white/45">
                    Dùng Product List của card partner để tạo sản phẩm card trong cửa hàng.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={deleteAllCardProducts}
                disabled={deletingCard}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-60"
              >
                Xóa toàn bộ Card
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="0.01"
                value={cardSyncForm.rateMultiplier}
                onChange={(e) => setCardSyncForm((prev) => ({ ...prev, rateMultiplier: e.target.value }))}
                placeholder="Hệ số giá vốn"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                step="0.01"
                value={cardSyncForm.markupPercent}
                onChange={(e) => setCardSyncForm((prev) => ({ ...prev, markupPercent: e.target.value }))}
                placeholder="Cộng lời theo %"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <input
                type="number"
                value={cardSyncForm.markupFixed}
                onChange={(e) => setCardSyncForm((prev) => ({ ...prev, markupFixed: e.target.value }))}
                placeholder="Cộng thêm cố định"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={cardSyncForm.updateExisting}
                  onChange={(e) => setCardSyncForm((prev) => ({ ...prev, updateExisting: e.target.checked }))}
                />
                Cập nhật lại sản phẩm cũ
              </label>
            </div>

            <input
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder="Tìm theo tên card, serviceCode hoặc mệnh giá..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
            />

            <button
              type="button"
              onClick={syncCardCatalog}
              disabled={syncingCard || filteredCardProducts.length === 0}
              className="w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-bold text-white hover:bg-fuchsia-500/90 disabled:opacity-60"
            >
              {syncingCard ? 'Đang đồng bộ catalog card...' : 'Đồng bộ catalog card vào cửa hàng'}
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
              <p className="font-bold text-white">Tóm tắt catalog hiện tại</p>
              <p className="mt-2 text-white/45">
                {filteredCardProducts.length.toLocaleString('vi-VN')} nhóm card • {cardValueCount.toLocaleString('vi-VN')} mệnh giá
              </p>
              <p className="mt-1 text-xs text-white/45">
                Đã đồng bộ {dbCardProducts.length} sản phẩm card vào hệ thống.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
              {filteredCardProducts.slice(0, 20).map((item) => (
                <div key={`${item.serviceCode}-${item.slug || item.name}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-white/45">{item.serviceCode || 'Chưa có serviceCode'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.values.slice(0, 12).map((subItem) => {
                          const dbProduct = dbCardProducts.find(p => 
                            String(p.sourceConfig?.serviceCode || '').toLowerCase() === String(item.serviceCode || '').toLowerCase() &&
                            Number(p.sourceConfig?.cardValue || 0) === Number(subItem.value)
                          );

                          return (
                            <div key={`${item.serviceCode}-${subItem.value}-${subItem.id || 'v'}`} className="group relative">
                              <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs transition-colors ${
                                  dbProduct 
                                    ? 'border-green-500/40 bg-green-500/10 text-green-300' 
                                    : 'border-white/10 bg-white/5 text-white/70'
                                }`}
                              >
                                {Number(subItem.value).toLocaleString('vi-VN')}đ
                              </span>
                              
                              {dbProduct && (
                                <div className="absolute bottom-full left-1/2 mb-2 hidden w-32 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl group-hover:block z-10">
                                  <p className="mb-2 text-[10px] font-bold text-white/60">Quản lý sản phẩm</p>
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => editProductPrice(dbProduct)}
                                      className="w-full rounded bg-white/5 py-1 text-[10px] text-white hover:bg-white/10"
                                    >
                                      Sửa giá
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteSingleProduct(dbProduct)}
                                      className="w-full rounded bg-red-500/20 py-1 text-[10px] text-red-300 hover:bg-red-500 hover:text-white"
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCardProducts.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-white/40">
                  Không có sản phẩm card nào khớp với bộ lọc.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TabSupplier;
