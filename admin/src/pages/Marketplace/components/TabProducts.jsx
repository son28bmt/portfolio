import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import api from '../../../services/api';

const formatVnd = (value) =>
  Number(value || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });

const emptyForm = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  sourceType: 'local_stock',
  supplierKind: 'smm_panel',
  serviceId: '',
  pricingModel: 'per_1000',
  minQuantity: '',
  maxQuantity: '',
  defaultQuantity: '',
  requiresTargetLink: true,
  requiresComments: false,
  targetLabel: 'Link mục tiêu',
  commentsLabel: 'Nội dung comments',
};

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const sourceTypeLabels = {
  local_stock: 'Kho nội bộ',
  supplier_api: 'Nhà cung cấp',
};

const supplierKindLabels = {
  smm_panel: 'Panel SMM',
  digital_code: 'Mã số / card',
};

const sectionLabels = {
  service: 'Dịch vụ số',
  custom: 'Tài Khoản',
  card: 'Card và mã số',
};

const TabProducts = ({ setError, setNotice, refreshKey }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productForm, setProductForm] = useState(emptyForm);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/admin/products'),
        api.get('/admin/categories'),
      ]);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch {
      setError('Lỗi tải dữ liệu sản phẩm hoặc danh mục.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => map.set(Number(item.id), item.name));
    return map;
  }, [categories]);

  const categoriesBySection = useMemo(
    () =>
      Object.keys(sectionLabels).map((sectionKey) => ({
        key: sectionKey,
        label: sectionLabels[sectionKey],
        items: categories
          .filter((item) => (item.storeSection || 'service') === sectionKey)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      })),
    [categories],
  );

  const buildSourceConfigPayload = () => {
    if (productForm.sourceType === 'local_stock') return {};

    return {
      supplierKind: productForm.supplierKind,
      serviceId: productForm.serviceId.trim() || null,
      pricingModel: productForm.pricingModel,
      minQuantity: toNullableNumber(productForm.minQuantity),
      maxQuantity: toNullableNumber(productForm.maxQuantity),
      defaultQuantity: toNullableNumber(productForm.defaultQuantity),
      requiresTargetLink: Boolean(productForm.requiresTargetLink),
      requiresComments: Boolean(productForm.requiresComments),
      targetLabel: productForm.targetLabel.trim() || null,
      commentsLabel: productForm.commentsLabel.trim() || null,
    };
  };

  const createProduct = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    try {
      await api.post('/admin/products', {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: Number(productForm.price || 0),
        category_id: Number(productForm.categoryId),
        quantity: 0,
        sourceType: productForm.sourceType,
        sourceConfig: buildSourceConfigPayload(),
      });

      setProductForm(emptyForm);
      setNotice('Đã tạo sản phẩm mới.');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo sản phẩm.');
    }
  };

  const editProduct = async (product) => {
    const nextPrice = window.prompt('Nhập giá bán mới (VND)', product.price);
    if (nextPrice === null) return;

    setError('');
    setNotice('');

    try {
      await api.put(`/admin/products/${product.id}`, {
        price: Number(nextPrice),
      });
      setNotice('Đã cập nhật giá sản phẩm.');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể cập nhật sản phẩm.');
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;

    setError('');
    setNotice('');

    try {
      await api.delete(`/admin/products/${product.id}`);
      setNotice('Đã xóa sản phẩm.');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa sản phẩm.');
    }
  };

  const sourceType = productForm.sourceType;

  return (
    <div className="glass animate-in fade-in zoom-in-95 space-y-5 rounded-[24px] p-6 duration-300">
      <div>
        <h2 className="text-xl font-bold">Sản phẩm</h2>
        <p className="mt-2 max-w-3xl text-sm text-white/45">
          Dùng để tạo hoặc chỉnh sản phẩm trong cửa hàng. Khi chọn danh mục, hệ thống sẽ chia rõ
          theo từng khu để bạn không gán nhầm sản phẩm sang lane khác.
        </p>
      </div>

      <form onSubmit={createProduct} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          value={productForm.name}
          onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Tên sản phẩm"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
          required
        />

        <select
          value={productForm.categoryId}
          onChange={(e) => setProductForm((prev) => ({ ...prev, categoryId: e.target.value }))}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
          required
        >
          <option value="">Chọn danh mục</option>
          {categoriesBySection.map((group) =>
            group.items.length > 0 ? (
              <optgroup key={group.key} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>

        <input
          value={productForm.price}
          onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
          placeholder="Giá bán"
          type="number"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
          required
        />

        <select
          value={productForm.sourceType}
          onChange={(e) => setProductForm((prev) => ({ ...prev, sourceType: e.target.value }))}
          className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
        >
          <option value="local_stock">Kho nội bộ</option>
          <option value="supplier_api">Nhà cung cấp</option>
        </select>

        {sourceType === 'supplier_api' && (
          <>
            <select
              value={productForm.supplierKind}
              onChange={(e) => setProductForm((prev) => ({ ...prev, supplierKind: e.target.value }))}
              className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="smm_panel">Panel SMM</option>
              <option value="digital_code">Mã số / card (để dành)</option>
            </select>

            <input
              value={productForm.serviceId}
              onChange={(e) => setProductForm((prev) => ({ ...prev, serviceId: e.target.value }))}
              placeholder="Mã dịch vụ từ nhà cung cấp"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <select
              value={productForm.pricingModel}
              onChange={(e) => setProductForm((prev) => ({ ...prev, pricingModel: e.target.value }))}
              className="cursor-pointer rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
            >
              <option value="fixed">Giá cố định / đơn</option>
              <option value="per_1000">Giá theo 1.000 đơn vị</option>
              <option value="per_unit">Giá theo từng đơn vị</option>
            </select>

            <input
              value={productForm.minQuantity}
              onChange={(e) => setProductForm((prev) => ({ ...prev, minQuantity: e.target.value }))}
              placeholder="Số lượng tối thiểu"
              type="number"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <input
              value={productForm.maxQuantity}
              onChange={(e) => setProductForm((prev) => ({ ...prev, maxQuantity: e.target.value }))}
              placeholder="Số lượng tối đa"
              type="number"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <input
              value={productForm.defaultQuantity}
              onChange={(e) =>
                setProductForm((prev) => ({ ...prev, defaultQuantity: e.target.value }))
              }
              placeholder="Số lượng mặc định"
              type="number"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <input
              value={productForm.targetLabel}
              onChange={(e) => setProductForm((prev) => ({ ...prev, targetLabel: e.target.value }))}
              placeholder="Tên ô nhập link"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <input
              value={productForm.commentsLabel}
              onChange={(e) =>
                setProductForm((prev) => ({ ...prev, commentsLabel: e.target.value }))
              }
              placeholder="Tên ô nhập nội dung comments"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={productForm.requiresTargetLink}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    requiresTargetLink: e.target.checked,
                  }))
                }
              />
              Bắt buộc khách nhập link mục tiêu
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={productForm.requiresComments}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    requiresComments: e.target.checked,
                  }))
                }
              />
              Bắt buộc khách nhập nội dung comments
            </label>
          </>
        )}

        <textarea
          value={productForm.description}
          onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Mô tả sản phẩm"
          className="custom-scrollbar min-h-[90px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:border-primary focus:outline-none md:col-span-2"
        />

        <button
          type="submit"
          className="glow rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] md:col-span-2"
        >
          Tạo sản phẩm
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-white/60">
            <tr>
              <th className="px-4 py-3 font-semibold">Tên</th>
              <th className="px-4 py-3 font-semibold">Danh mục</th>
              <th className="px-4 py-3 font-semibold">Giá bán</th>
              <th className="px-4 py-3 font-semibold">Nguồn hàng</th>
              <th className="px-4 py-3 font-semibold">Số lượng</th>
              <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {products.map((item) => {
              const supplierKind = item.sourceConfig?.supplierKind || '';
              const sourceSummary =
                item.sourceType === 'supplier_api'
                  ? `${supplierKindLabels[supplierKind] || 'Nhà cung cấp'} / ${item.sourceConfig?.serviceId || 'Chưa có mã'}`
                  : sourceTypeLabels.local_stock;

              return (
                <tr key={item.id} className="transition-colors hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-white/70">
                    <div>{item.category?.name || categoryMap.get(Number(item.categoryId)) || '-'}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {sectionLabels[item.category?.storeSection || 'service'] || 'Dịch vụ số'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-400">{formatVnd(item.price)}</td>
                  <td className="px-4 py-3 text-white/70">{sourceSummary}</td>
                  <td className="px-4 py-3 text-white/70">
                    <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold">
                      {Number(item.quantity || 0).toLocaleString('vi-VN')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => editProduct(item)}
                        className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
                        title="Sửa giá"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteProduct(item)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 shadow-sm transition-all hover:bg-red-500 hover:text-white"
                        title="Xóa sản phẩm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {products.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-white/40">
                  Chưa có sản phẩm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabProducts;
