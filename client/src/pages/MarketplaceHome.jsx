import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  Layers3,
  PackageSearch,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

const storeLanes = [
  {
    title: 'Dịch vụ số',
    subtitle: 'Đang hoạt động',
    description:
      'Các gói social và dịch vụ số đang mở bán. Chọn nền tảng, cấu hình đơn hàng và theo dõi tiến độ ngay trên web.',
    href: '/cua-hang/dich-vu',
    cta: 'Vào khu dịch vụ',
    accent:
      'border-cyan-400/25 bg-[linear-gradient(180deg,rgba(5,26,48,0.96),rgba(5,14,28,0.98))] shadow-[0_0_42px_rgba(34,211,238,0.12)]',
    iconWrap: 'border-cyan-400/30 bg-cyan-400/12 text-cyan-200',
    statusWrap: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100/80',
    icon: Layers3,
    bullets: ['Dịch vụ social đang bán', 'Thanh toán QR và quỹ nội bộ', 'Tra cứu đơn ngay trên web'],
  },
  {
    title: 'Card và mã số',
    subtitle: 'Đang hoạt động',
    description:
      'Khu riêng cho card, giftcode và mã số giao ngay. Chọn nhà mạng hoặc loại thẻ rồi thanh toán để nhận mã.',
    href: '/cua-hang/card',
    cta: 'Vào khu card',
    accent:
      'border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(34,10,40,0.94),rgba(15,9,24,0.98))] shadow-[0_0_42px_rgba(217,70,239,0.10)]',
    iconWrap: 'border-fuchsia-400/25 bg-fuchsia-400/12 text-fuchsia-200',
    statusWrap: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100/80',
    icon: CreditCard,
    bullets: ['Nhận mã ngay sau khi nhà cung cấp trả về', 'Hỗ trợ tra cứu lại dữ liệu đã giao', 'Phù hợp cho card và giftcode'],
  },
  {
    title: 'Account & key',
    subtitle: 'Đang hoạt động',
    description:
      'Khu dành cho tài khoản, file, tool hoặc các sản phẩm bạn tự nhập và tự quản lý trong kho nội bộ.',
    href: '/cua-hang/tu-them',
    cta: 'Vào khu tự thêm',
    accent:
      'border-emerald-400/20 bg-[linear-gradient(180deg,rgba(10,36,29,0.96),rgba(8,18,18,0.98))] shadow-[0_0_42px_rgba(52,211,153,0.10)]',
    iconWrap: 'border-emerald-400/25 bg-emerald-400/12 text-emerald-200',
    statusWrap: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100/80',
    icon: PackageSearch,
    bullets: ['Kho nội bộ tự quản lý', 'Giao hàng theo dữ liệu bạn nhập', 'Phù hợp cho tài khoản, file, key riêng'],
  },
];

const MarketplaceHome = () => {
  return (
    <div className="mx-auto max-w-[1480px] space-y-8 px-4 py-10 sm:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_26%),linear-gradient(180deg,rgba(8,15,30,0.98),rgba(4,8,18,0.98))] p-6 shadow-[0_0_48px_rgba(34,211,238,0.06)] md:p-8 xl:p-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Cửa hàng
            </div>
            <h1 className="mt-5 flex items-center gap-3 text-3xl font-black text-white md:text-5xl">
              Cửa hàng số
              <ShoppingBag className="h-8 w-8 text-primary md:h-10 md:w-10" />
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
              Chọn đúng khu để mua nhanh hơn. Dịch vụ số, card và mã số, cùng các Account & key
              hiện đã có lane riêng để dễ quản lý và mở rộng về sau.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Khu 1</p>
              <p className="mt-2 text-lg font-bold text-white">Dịch vụ số</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Khu 2</p>
              <p className="mt-2 text-lg font-bold text-white">Card và mã số</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Khu 3</p>
              <p className="mt-2 text-lg font-bold text-white">Account & key</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {storeLanes.map((lane) => {
          const Icon = lane.icon;

          return (
            <article key={lane.title} className={`flex h-full flex-col rounded-[30px] border p-6 ${lane.accent}`}>
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${lane.iconWrap}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] ${lane.statusWrap}`}>
                  {lane.subtitle}
                </div>
              </div>

              <div className="mt-6 flex-1">
                <h2 className="text-2xl font-black text-white">{lane.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/65">{lane.description}</p>

                <div className="mt-6 space-y-3">
                  {lane.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={lane.href}
                className="mt-8 inline-flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                {lane.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">Gợi ý</p>
            <h3 className="mt-2 text-xl font-bold text-white">Chọn đúng lane để thao tác nhanh hơn</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            Cập nhật liên tục
          </div>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-white/60">
          Nếu bạn cần mua dịch vụ social, vào khu dịch vụ số. Nếu cần card, giftcode hoặc mã số giao
          ngay, vào khu card. Nếu cần bán tài khoản hoặc dữ liệu tự quản lý, hãy dùng khu Account & key.
        </p>
      </section>
    </div>
  );
};

export default MarketplaceHome;
