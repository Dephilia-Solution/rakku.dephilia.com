"use client";

import { useEffect, useRef } from "react";

const MODAL_STATE_KEY = "modal-open";

export function useModalHistory(isOpen: boolean, onClose: () => void) {
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      isClosingRef.current = false;
      return;
    }

    const handlePopState = () => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      onCloseRef.current();
    };

    window.history.pushState({ key: MODAL_STATE_KEY }, "");
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.key === MODAL_STATE_KEY) {
        window.history.back();
      }
      isClosingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCloseAndPop = () => {
    if (isClosingRef.current) return;
    if (window.history.state?.key === MODAL_STATE_KEY) {
      window.history.back();
    } else {
      isClosingRef.current = true;
      onCloseRef.current();
    }
  };

  return { handleCloseAndPop };
}
