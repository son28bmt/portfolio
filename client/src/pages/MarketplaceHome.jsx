import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  Layers3,
  PackageSearch,
  Smartphone,
  Wrench,
} from 'lucide-react';
import useMarketplaceSectionStatus from '../hooks/useMarketplaceSectionStatus';

const storeLanes = [
  {
    title: 'Dịch vụ số',
    subtitle: 'Đang hoạt động',
    description:
      'Các gói social và dịch vụ số đang mở bán. Chọn nền tảng, cấu hình đơn hàng và theo dõi tiến độ ngay trên web.',
    href: '/cua-hang/dich-vu',
    cta: 'Vào khu dịch vụ',
    icon: Layers3,
    bullets: ['Dịch vụ social đang bán', 'Thanh toán QR và quỹ nội bộ', 'Tra cứu đơn ngay trên web'],
  },
  {
    title: 'Nạp tiền nhanh',
    subtitle: 'Đang hoạt động',
    description:
      'Nạp tiền điện thoại, data hoặc nạp tiền game trực tiếp vào tài khoản. Nhập số điện thoại và thanh toán.',
    href: '/cua-hang/topup',
    cta: 'Vào khu nạp tiền',
    icon: Smartphone,
    bullets: ['Nạp trực tiếp vào SĐT', 'Hỗ trợ tất cả nhà mạng', 'Nạp tiền game nhanh chóng'],
  },
  {
    title: 'Card và mã số',
    subtitle: 'Đang hoạt động',
    description:
      'Khu riêng cho card, giftcode và mã số giao ngay. Chọn nhà mạng hoặc loại thẻ rồi thanh toán để nhận mã.',
    href: '/cua-hang/card',
    cta: 'Vào khu card',
    icon: CreditCard,
    bullets: ['Nhận mã ngay sau khi mua', 'Hỗ trợ tra cứu lại mã', 'Phù hợp cho card và giftcode'],
  },
  {
    title: 'Account & key',
    subtitle: 'Đang hoạt động',
    description:
      'Khu dành cho tài khoản, file, tool hoặc các sản phẩm bạn tự nhập và tự quản lý trong kho nội bộ.',
    href: '/cua-hang/account',
    cta: 'Vào khu account',
    icon: PackageSearch,
    bullets: ['Kho nội bộ tự quản lý', 'Giao hàng tự động', 'Phù hợp cho tài khoản, key'],
  },
];

const MarketplaceHome = () => {
  const { getSection } = useMarketplaceSectionStatus();

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 lg:py-16">
      <header className="border-b border-border pb-8">
        <p className="text-sm text-muted">Cửa hàng</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-text sm:text-5xl">
          Cửa hàng số
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
          Chọn đúng khu để mua nhanh hơn. Dịch vụ số, nạp tiền nhanh, card và mã số, cùng các Account & key
          hiện đã có lane riêng để dễ quản lý.
        </p>

        <nav aria-label="Khu vực cửa hàng" className="mt-8 -mb-8 overflow-x-auto">
          <ul className="flex min-w-max gap-6 border-b border-border">
            {storeLanes.map((lane) => (
              <li key={lane.href}>
                <Link
                  to={lane.href}
                  className="inline-flex min-h-12 items-center border-b border-transparent text-sm text-muted transition-colors duration-200 hover:border-border-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {lane.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section aria-label="Các khu mua sắm" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {storeLanes.map((lane) => {
          const Icon = lane.icon;
          const sectionKey = lane.href.endsWith('/card')
            ? 'card'
            : lane.href.endsWith('/topup')
              ? 'topup'
              : lane.href.endsWith('/account')
                ? 'custom'
                : 'service';
          const status = getSection(sectionKey);
          const isMaintenance = status.enabled === false;

          return (
            <article
              key={lane.title}
              className="flex h-full flex-col rounded-md border border-border bg-surface p-5 transition-colors duration-200 hover:border-border-hover sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <Icon aria-hidden="true" className="h-5 w-5 text-muted" />
                <span className="inline-flex items-center gap-2 text-xs text-muted">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${isMaintenance ? 'bg-warning' : 'bg-success'}`}
                  />
                  <span className={isMaintenance ? 'text-warning' : 'text-success'}>
                    {isMaintenance ? 'Đang bảo trì' : lane.subtitle}
                  </span>
                </span>
              </div>

              <div className="mt-6 flex-1">
                <h2 className="text-xl font-semibold leading-tight text-text">{lane.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {isMaintenance ? status.message : lane.description}
                </p>

                <ul className="mt-5 divide-y divide-border text-sm text-muted">
                  {lane.bullets.map((bullet) => (
                    <li key={bullet} className="py-3 first:pt-0 last:pb-0">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              {isMaintenance ? (
                <div className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded border border-border px-3 text-sm text-warning">
                  <Wrench aria-hidden="true" className="h-4 w-4" />
                  Đang bảo trì
                </div>
              ) : (
                <Link
                  to={lane.href}
                  className="mt-6 inline-flex min-h-10 items-center justify-between gap-3 rounded border border-border px-3 text-sm font-medium text-text transition-colors duration-200 hover:border-border-hover hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {lane.cta}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted" />
                </Link>
              )}
            </article>
          );
        })}
      </section>

      <section className="border-t border-border pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs text-muted">Gợi ý</p>
            <h2 className="mt-2 text-lg font-medium text-text">Chọn đúng lane để thao tác nhanh hơn</h2>
          </div>
          <span className="text-xs text-muted">Cập nhật liên tục</span>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-muted">
          Nếu bạn cần mua dịch vụ social, vào khu dịch vụ số. Nếu cần card, giftcode hoặc mã số giao
          ngay, vào khu card. Nếu cần bán tài khoản hoặc dữ liệu tự quản lý, hãy dùng khu Account & key.
        </p>
      </section>
    </div>
  );
};

export default MarketplaceHome;
