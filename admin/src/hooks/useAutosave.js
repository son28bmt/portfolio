import { useEffect, useRef, useState } from 'react';

export default function useAutosave({ enabled, value, save, delay = 20000 }) {
  const [state, setState] = useState({ status: 'idle', at: null });
  const latest = useRef(value);
  const saveRef = useRef(save);
  latest.current = value;
  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return undefined;
    setState(prev => ({ ...prev, status: 'pending' }));
    const timer = setTimeout(async () => {
      setState(prev => ({ ...prev, status: 'saving' }));
      try {
        await saveRef.current(latest.current);
        setState({ status: 'saved', at: new Date() });
      } catch { setState(prev => ({ ...prev, status: 'error' })); }
    }, delay);
    return () => clearTimeout(timer);
  }, [enabled, value, delay]);

  return state;
}