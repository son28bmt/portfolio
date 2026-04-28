import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';

const MarketplaceMaintenance = ({
  title = 'Đang bảo trì',
  message = 'Khu này đang bảo trì. Vui lòng quay lại sau.',
}) => {
  return (
    <div className="mx-auto max-w-[960px] px-4 py-16 sm:px-6 xl:px-8">
      <section className="rounded-[30px] border border-orange-400/20 bg-[linear-gradient(180deg,rgba(46,29,12,0.96),rgba(16,12,10,0.98))] p-6 text-center shadow-[0_0_42px_rgba(251,146,60,0.10)] md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-orange-400/25 bg-orange-400/12 text-orange-200">
          <Wrench className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-orange-200/70">
          Đang bảo trì
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
          {message}
        </p>
        <Link
          to="/cua-hang"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Về cửa hàng
        </Link>
      </section>
    </div>
  );
};

export default MarketplaceMaintenance;
