import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, CreditCard, Sparkles } from 'lucide-react';

const MarketplaceCards = () => {
  return (
    <div className="mx-auto max-w-[1180px] space-y-8 px-4 py-10 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            Khu card
          </div>
          <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">Khu card đang phát triển</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
            Nơi này sẽ dành cho card, key và mã kích hoạt. Hiện tại trang vẫn đang được hoàn thiện,
            vui lòng quay lại sau.
          </p>
        </div>

        <Link
          to="/cua-hang"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại cửa hàng
        </Link>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-fuchsia-400/15 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.12),transparent_28%),linear-gradient(180deg,rgba(21,10,33,0.98),rgba(11,8,20,0.98))] p-6 shadow-[0_0_42px_rgba(217,70,239,0.08)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-100/55">Coming soon</p>
            <h2 className="mt-3 text-2xl font-black text-white md:text-4xl">
              Đang phát triển, vui lòng đợi
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/65 md:text-base">
              Khi mở bán, khu này sẽ tập trung vào card, key, mã kích hoạt và các sản phẩm giao ngay.
              Hiện tại bạn vẫn có thể tiếp tục mua ở khu dịch vụ số.
            </p>
          </div>

          <div className="flex h-36 w-full max-w-[320px] items-center justify-center rounded-[28px] border border-fuchsia-400/20 bg-black/20">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Card Store</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                  Coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">Danh mục</p>
          <p className="mt-3 text-lg font-bold text-white">Card, key và mã kích hoạt</p>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">Dự kiến</p>
          <p className="mt-3 text-lg font-bold text-white">Ưu tiên giao ngay và dễ tra cứu</p>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/35">Trạng thái</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100/80">
            <Clock3 className="h-3.5 w-3.5" />
            Đang phát triển
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketplaceCards;
