"use client";

import { useEffect, useRef } from "react";
import { useMerchantRuntime } from "@pos/lib/merchant-runtime";

const MODAL_STATE_KEY = "modal-open";

export function useModalHistory(isOpen: boolean, onClose: () => void, handleEscape = true) {
  const runtime = useMerchantRuntime();
  const scoped = Boolean(runtime);
  const scopedEscape = scoped && handleEscape;
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

    if (scoped) {
      const handleKey = (event: KeyboardEvent) => {
        if (event.key === "Escape" && scopedEscape && !isClosingRef.current) {
          isClosingRef.current = true;
          onCloseRef.current();
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => {
        window.removeEventListener("keydown", handleKey);
        isClosingRef.current = false;
      };
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
  }, [isOpen, scoped, scopedEscape]);

  const handleCloseAndPop = () => {
    if (isClosingRef.current) return;
    if (!scoped && window.history.state?.key === MODAL_STATE_KEY) {
      window.history.back();
    } else {
      isClosingRef.current = true;
      onCloseRef.current();
    }
  };

  return { handleCloseAndPop };
}
