"use client";

import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export function useSwipe(
  handlers: SwipeHandlers,
  threshold = 50
) {
  const startX = useRef(0);
  const startY = useRef(0);
  const distX = useRef(0);
  const distY = useRef(0);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      distX.current = 0;
      distY.current = 0;
    },
    []
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    distX.current = e.touches[0].clientX - startX.current;
    distY.current = e.touches[0].clientY - startY.current;
  }, []);

  const onTouchEnd = useCallback(() => {
    const absX = Math.abs(distX.current);
    const absY = Math.abs(distY.current);

    if (absX > absY && absX > threshold) {
      if (distX.current > 0) handlers.onSwipeRight?.();
      else handlers.onSwipeLeft?.();
    } else if (absY > threshold) {
      if (distY.current > 0) handlers.onSwipeDown?.();
      else handlers.onSwipeUp?.();
    }
  }, [handlers, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
