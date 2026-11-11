import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 64;
const PULL_MAX = 96;

/** Touch pull-to-refresh against the nearest scrolling ancestor. */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scroller = findScrollParent(el);
    let startY: number | null = null;
    let current = 0;
    let busy = false;

    const onStart = (e: TouchEvent) => {
      startY = !busy && scroller.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0 || scroller.scrollTop > 0) {
        current = 0;
        setDistance(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      current = Math.min(PULL_MAX, delta * 0.5);
      setDistance(current);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      const trigger = current >= PULL_THRESHOLD;
      current = 0;
      setDistance(0);
      if (!trigger) return;
      busy = true;
      setRefreshing(true);
      refreshRef.current().finally(() => {
        busy = false;
        setRefreshing(false);
      });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return {
    ref,
    distance,
    refreshing,
    armed: distance >= PULL_THRESHOLD,
  };
}

function findScrollParent(el: HTMLElement): HTMLElement {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return document.scrollingElement as HTMLElement;
}
