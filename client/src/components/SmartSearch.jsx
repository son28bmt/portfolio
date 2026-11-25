import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CornerDownLeft, LoaderCircle, Search, Sparkles } from 'lucide-react';
import api from '../services/api';

const MATCH_LABELS = {
  title: 'Tiêu đề',
  seoTitle: 'Tiêu đề',
  topic: 'Chủ đề',
  tags: 'Từ khóa',
  slug: 'Từ khóa',
  excerpt: 'Mô tả',
  seoDescription: 'Mô tả',
  content: 'Nội dung',
};

const getItemUrl = (type, item) => type === 'guide'
  ? `/huong-dan/${encodeURIComponent(item.slug || item.id)}`
  : `/blog/${encodeURIComponent(item.slug || item.id)}`;

const normalizeWithMap = (value) => {
  const original = String(value || '');
  let normalized = '';
  const startIndexes = [];
  const endIndexes = [];

  for (let index = 0; index < original.length;) {
    const start = index;
    const character = String.fromCodePoint(original.codePointAt(index));
    index += character.length;
    const normalizedCharacter = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

    for (const part of normalizedCharacter) {
      if (/[a-z0-9]/.test(part)) {
        normalized += part;
        startIndexes.push(start);
        endIndexes.push(index);
      } else if (normalized && !normalized.endsWith(' ')) {
        normalized += ' ';
        startIndexes.push(start);
        endIndexes.push(index);
      }
    }
  }

  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1);
    startIndexes.pop();
    endIndexes.pop();
  }

  return { normalized, startIndexes, endIndexes };
};

const highlightMatch = (text, query) => {
  if (!text || !query) return text;
  const normalizedText = normalizeWithMap(text);
  const normalizedQuery = normalizeWithMap(query).normalized;
  if (!normalizedQuery) return text;
  const matchIndex = normalizedText.normalized.indexOf(normalizedQuery);
  if (matchIndex < 0) return text;
  const start = normalizedText.startIndexes[matchIndex];
  const end = normalizedText.endIndexes[matchIndex + normalizedQuery.length - 1];
  if (start < 0) return text;
  return <>{text.slice(0, start)}<mark className="rounded bg-primary/25 text-inherit">{text.slice(start, end)}</mark>{text.slice(end)}</>;
};

export default function SmartSearch({
  type,
  value,
  onChange,
  onSearch,
  topic = '',
  placeholder = 'Tìm bài viết...',
  className = '',
  inputClassName = '',
}) {
  const navigate = useNavigate();
  const id = useId();
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [suggestions, setSuggestions] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const query = String(value || '').trim();

    if (query.length < 2) {
      setSuggestions([]);
      setTotalMatches(0);
      setLoading(false);
      setActiveIndex(-1);
      setOpen(false);
      return () => controller.abort();
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.get('/search/suggestions', {
          params: { type, q: query, ...(topic ? { topic } : {}) },
          signal: controller.signal,
        });
        if (requestRef.current !== requestId) return;
        setSuggestions(Array.isArray(data?.items) ? data.items : []);
        setTotalMatches(Number(data?.total || 0));
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted && requestRef.current === requestId) {
          setSuggestions([]);
          setTotalMatches(0);
        }
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [type, topic, value]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  const selectSuggestion = (item) => {
    setOpen(false);
    navigate(getItemUrl(type, item));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        setOpen(false);
        onSearch?.(String(value || '').trim());
      }
    }
  };

  const listId = `${id}-suggestions`;

  return <div ref={rootRef} className={`relative ${className}`}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-white/35" />
    <input
      type="search"
      role="combobox"
      aria-label={placeholder}
      aria-autocomplete="list"
      aria-expanded={open && String(value || '').trim().length >= 2}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={event => onChange(event.target.value)}
      onFocus={() => { if (String(value || '').trim().length >= 2) setOpen(true); }}
      onKeyDown={handleKeyDown}
      className={`w-full rounded-lg border border-white/10 bg-white/[0.04] py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-primary/50 focus:bg-white/[0.06] ${inputClassName}`}
    />
    {loading
      ? <LoaderCircle aria-hidden="true" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
      : String(value || '').trim() && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/30">ESC</span>}

    {open && String(value || '').trim().length >= 2 && <div
      id={listId}
      role="listbox"
      aria-label="Gợi ý bài viết"
      className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#101112] shadow-2xl shadow-black/60"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
        Gợi ý bài viết
        {suggestions.length > 0 && <span className="ml-auto normal-case tracking-normal">{totalMatches} kết quả phù hợp</span>}
      </div>

      {loading && suggestions.length === 0
        ? <p role="status" className="px-4 py-4 text-sm text-white/50">Đang tìm bài viết...</p>
        : suggestions.length > 0
          ? <ul className="max-h-[min(360px,60vh)] overflow-y-auto py-1">
            {suggestions.map((item, index) => <li key={`${type}-${item.id}`}>
              <button
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectSuggestion(item)}
                className={`flex w-full items-start gap-3 px-3 py-3 text-left transition ${activeIndex === index ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}
              >
                {item.image
                  ? <img src={item.image} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-md border border-white/10 object-cover" />
                  : <span aria-hidden="true" className="grid h-12 w-16 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04]"><Search className="h-4 w-4 text-white/30" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-2 text-sm font-semibold leading-5 text-white">{highlightMatch(item.title, String(value || '').trim())}</span>
                  {item.excerpt && <span className="mt-1 block line-clamp-2 text-xs leading-4 text-white/45">{item.excerpt.replace(/<[^>]*>/g, ' ')}</span>}
                  <span className="mt-1.5 inline-flex rounded border border-primary/20 bg-primary/[0.08] px-1.5 py-0.5 text-[10px] text-primary/90">Khớp {MATCH_LABELS[item.matchedBy] || 'nội dung'}</span>
                </span>
                <ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-white/30" />
              </button>
            </li>)}
          </ul>
          : <div className="px-4 py-4">
            <p className="text-sm text-white/70">Chưa tìm thấy bài phù hợp.</p>
            <p className="mt-1 text-xs text-white/40">Thử từ khóa ngắn hơn hoặc bỏ dấu tiếng Việt.</p>
          </div>}

      <div className="flex items-center justify-between border-t border-white/[0.07] px-3 py-2 text-[10px] text-white/35">
        <span>Dùng ↑ ↓ để chọn · ESC để đóng</span>
        <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Enter để tìm</span>
      </div>
    </div>}
  </div>;
}