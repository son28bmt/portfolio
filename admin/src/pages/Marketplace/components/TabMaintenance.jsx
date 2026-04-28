import React, { useEffect, useMemo, useState } from 'react';
import { Power, RefreshCw, Save, Wrench } from 'lucide-react';
import api from '../../../services/api';

const defaultSections = {
  service: {
    enabled: true,
    message: 'Khu dịch vụ số đang bảo trì. Vui lòng quay lại sau.',
  },
  card: {
    enabled: true,
    message: 'Khu card và mã số đang bảo trì. Vui lòng quay lại sau.',
  },
  custom: {
    enabled: true,
    message: 'Khu Account & key đang bảo trì. Vui lòng quay lại sau.',
  },
};

const sectionMeta = [
  {
    key: 'service',
    label: 'Dịch vụ số',
    description: 'Ảnh hưởng /cua-hang/dich-vu và các sản phẩm supplier SMM.',
    tone: 'cyan',
  },
  {
    key: 'card',
    label: 'Card và mã số',
    description: 'Ảnh hưởng /cua-hang/card và các sản phẩm digital_code.',
    tone: 'fuchsia',
  },
  {
    key: 'custom',
    label: 'Account & key',
    description: 'Ảnh hưởng /cua-hang/account và các sản phẩm kho nội bộ.',
    tone: 'emerald',
  },
];

const toneClasses = {
  cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200',
  fuchsia: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200',
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
};

const normalizeSections = (value = {}) =>
  Object.fromEntries(
    Object.entries(defaultSections).map(([key, fallback]) => [
      key,
      {
        enabled: value?.[key]?.enabled !== false,
        message: String(value?.[key]?.message || fallback.message),
      },
    ]),
  );

const TabMaintenance = ({ setError, setNotice, refreshKey }) => {
  const [sections, setSections] = useState(defaultSections);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const disabledCount = useMemo(
    () => Object.values(sections).filter((item) => item.enabled === false).length,
    [sections],
  );

  const fetchStatus = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/admin/section-status');
      setSections(normalizeSections(data?.sections));
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải trạng thái bảo trì.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus({ silent: true });
  }, [refreshKey]);

  const updateSection = (key, patch) => {
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || defaultSections[key]),
        ...patch,
      },
    }));
  };

  const saveStatus = async () => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.put('/admin/section-status', { sections });
      setSections(normalizeSections(data?.sections));
      setNotice('Đã cập nhật trạng thái bảo trì của cửa hàng.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể lưu trạng thái bảo trì.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass animate-in fade-in zoom-in-95 space-y-5 rounded-[24px] p-6 duration-300">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-orange-200">
            <Wrench className="h-4 w-4" />
            Bảo trì cửa hàng
          </div>
          <h2 className="mt-4 text-xl font-bold">Tắt / mở từng khu bán hàng</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/45">
            Khi một khu bị tắt, client sẽ hiện trạng thái đang bảo trì và backend sẽ chặn tạo đơn mới cho khu đó.
            Tra cứu đơn cũ và webhook thanh toán vẫn tiếp tục hoạt động.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => fetchStatus()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={saveStatus}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/60">
          Hien co{' '}
          <span className={disabledCount > 0 ? 'font-bold text-orange-300' : 'font-bold text-emerald-300'}>
            {disabledCount}
          </span>{' '}
          khu đang bảo trì.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {sectionMeta.map((section) => {
          const item = sections[section.key] || defaultSections[section.key];
          const isEnabled = item.enabled !== false;

          return (
            <section key={section.key} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${toneClasses[section.tone]}`}>
                    {section.label}
                  </span>
                  <p className="mt-4 text-sm text-white/45">{section.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSection(section.key, { enabled: !isEnabled })}
                  className={`inline-flex h-11 w-20 items-center rounded-full border p-1 transition-colors ${
                    isEnabled
                      ? 'justify-end border-emerald-400/20 bg-emerald-400/20 text-emerald-200'
                      : 'justify-start border-orange-400/20 bg-orange-400/20 text-orange-200'
                  }`}
                  aria-pressed={isEnabled}
                  title={isEnabled ? 'Đang mở bán' : 'Đang bảo trì'}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-background">
                    <Power className="h-4 w-4" />
                  </span>
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">Trang thai</p>
                <p className={`mt-2 text-lg font-black ${isEnabled ? 'text-emerald-300' : 'text-orange-300'}`}>
                  {isEnabled ? 'Đang mở bán' : 'Đang bảo trì'}
                </p>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                  Thông báo hiện trên client
                </span>
                <textarea
                  value={item.message}
                  onChange={(event) => updateSection(section.key, { message: event.target.value })}
                  className="custom-scrollbar mt-2 min-h-[110px] w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                />
              </label>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default TabMaintenance;
