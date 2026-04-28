import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

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

export const useMarketplaceSectionStatus = () => {
  const [sections, setSections] = useState(defaultSections);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .get('/section-status')
      .then(({ data }) => {
        if (active) setSections(normalizeSections(data?.sections));
      })
      .catch(() => {
        if (active) setSections(defaultSections);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({
      sections,
      loading,
      getSection: (key) => sections[key] || defaultSections[key] || { enabled: true, message: '' },
    }),
    [loading, sections],
  );
};

export default useMarketplaceSectionStatus;
