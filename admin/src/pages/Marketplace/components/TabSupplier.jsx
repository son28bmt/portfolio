import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Database, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const normalizeServices = (items) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    service: String(item?.service || '').trim(),
    name: String(item?.name || '').trim(),
    category: String(item?.category || '').trim(),
    type: String(item?.type || '').trim(),
    rate: Number(item?.rate || 0),
    min: Number(item?.min || 0),
    max: Number(item?.max || 0),
  }));

const initialSyncForm = {
  rateMultiplier: '1',
  markupPercent: '0',
  markupFixed: '0',
  pricingModel: 'per_1000',
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

const TabSupplier = ({ setError, setNotice, refreshKey }) => {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState({
    fulfillmentStatus: 'processing',
    email: '',
  });
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [syncForm, setSyncForm] = useState(initialSyncForm);

  const fetchSupplierData = async ({ silent = false } = {}) => {
    if (!silent) {
      setServicesLoading(true);
      setQueueLoading(true);
      setError('');
    }

    try {
      const [servicesRes, balanceRes, ordersRes] = await Promise.all([
        api.get('/admin/supplier/smm-panel/services'),
        api.get('/admin/supplier/smm-panel/balance'),
        api.get('/admin/orders', {
          params: {
            sourceType: 'supplier_api',
            fulfillmentStatus: queueFilter.fulfillmentStatus,
            email: queueFilter.email,
            page: 1,
            limit: 20,
          },
        }),
      ]);

      setServices(normalizeServices(servicesRes.data?.items));
      setBalanceInfo(balanceRes.data || null);
      setSupplierOrders(Array.isArray(ordersRes.data?.items) ? ordersRes.data.items : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu nhà cung cấp.');
    } finally {
      setServicesLoading(false);
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData({ silent: true });
  }, [refreshKey, queueFilter.fulfillmentStatus, queueFilter.email]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return services;

    return services.filter((item) =>
      `${item.service} ${item.name} ${item.category} ${item.type}`.toLowerCase().includes(query),
    );
  }, [services, serviceSearch]);

  const visibleServices = useMemo(() => filteredServices.slice(0, 30), [filteredServices]);

  const syncServices = async (serviceIds, label = 'các dịch vụ đã chọn') => {
    if (!serviceIds.length) {
      setError('Không có dịch vụ nào để đồng bộ.');
      return;
    }

    setSyncing(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.post('/admin/supplier/smm-panel/sync-services', {
        serviceIds,
        pricingModel: syncForm.pricingModel,
        rateMultiplier: Number(syncForm.rateMultiplier || 1),
        markupPercent: Number(syncForm.markupPercent || 0),
        markupFixed: Number(syncForm.markupFixed || 0),
        updateExisting: syncForm.updateExisting,
      });

      setNotice(
        `Đã đồng bộ ${label}: tạo ${data.created || 0}, cập nhật ${data.updated || 0}, bỏ qua ${data.skipped || 0}.`,
      );
      await fetchSupplierData({ silent: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể đồng bộ dịch vụ từ SMM panel.');
    } finally {
      setSyncing(false);
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
              Khu này dùng để xem số dư panel, nhập dịch vụ từ nhà cung cấp vào cửa hàng và theo
              dõi các đơn đang chạy qua supplier.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fetchSupplierData()}
              disabled={servicesLoading || queueLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${servicesLoading || queueLoading ? 'animate-spin' : ''}`}
              />
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

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-200">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Số dư panel</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {balanceInfo ? formatVnd(balanceInfo.balance) : 'Chưa tải'}
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
                  {
                    supplierOrders.filter((item) => item.fulfillmentStatus === 'processing').length
                  }
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
                  {
                    supplierOrders.filter((item) => item.fulfillmentStatus === 'manual_review').length
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <div>{item.fulfillmentPayload?.externalStatus || '-'}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">
                        {item.fulfillmentPayload?.externalOrderId || 'Chưa có mã ngoài'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/75">
                        {item.fulfillmentStatus || '-'}
                      </span>
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

        <section className="glass space-y-4 rounded-[24px] p-6">
          <div>
            <h3 className="text-lg font-bold">Nhập dịch vụ từ panel</h3>
            <p className="mt-1 text-sm text-white/45">
              Chọn cách tính giá bán, mức cộng lời rồi nhập nhanh các dịch vụ cần bán vào cửa hàng.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.01"
              value={syncForm.rateMultiplier}
              onChange={(e) => setSyncForm((prev) => ({ ...prev, rateMultiplier: e.target.value }))}
              placeholder="Hệ số giá vốn"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              step="0.01"
              value={syncForm.markupPercent}
              onChange={(e) => setSyncForm((prev) => ({ ...prev, markupPercent: e.target.value }))}
              placeholder="Cộng lời theo %"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <input
              type="number"
              value={syncForm.markupFixed}
              onChange={(e) => setSyncForm((prev) => ({ ...prev, markupFixed: e.target.value }))}
              placeholder="Cộng thêm cố định"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <select
              value={syncForm.pricingModel}
              onChange={(e) => setSyncForm((prev) => ({ ...prev, pricingModel: e.target.value }))}
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
              checked={syncForm.updateExisting}
              onChange={(e) => setSyncForm((prev) => ({ ...prev, updateExisting: e.target.checked }))}
            />
            Cập nhật lại cả những sản phẩm đã nhập trước đó
          </label>

          <input
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            placeholder="Tìm theo mã dịch vụ, tên dịch vụ hoặc danh mục..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary"
          />

          <button
            type="button"
            onClick={() =>
              syncServices(
                filteredServices.map((item) => item.service),
                `${filteredServices.length.toLocaleString('vi-VN')} dịch vụ đang lọc`,
              )
            }
            disabled={syncing || filteredServices.length === 0}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {syncing ? 'Đang nhập dịch vụ...' : 'Nhập toàn bộ kết quả đang lọc'}
          </button>

          <div className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
            {visibleServices.map((item) => (
              <div
                key={item.service}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{item.name || `Dịch vụ ${item.service}`}</p>
                    <p className="mt-1 text-xs text-white/45">
                      #{item.service} · {item.category || 'SMM Panel'}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {formatVnd(item.rate)} · {Number(item.min || 0).toLocaleString('vi-VN')} -{' '}
                      {Number(item.max || 0).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncServices([item.service], `dịch vụ ${item.service}`)}
                    disabled={syncing}
                    className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-60"
                  >
                    Nhập
                  </button>
                </div>
              </div>
            ))}

            {visibleServices.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-white/40">
                Không có dịch vụ nào khớp với bộ lọc.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TabSupplier;
