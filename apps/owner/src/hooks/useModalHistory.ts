"use client";

import { useEffect, useRef, useId } from "react";
import { useMerchantRuntime } from "@/lib/merchant-runtime";

const MODAL_STATE_KEY = "modal-open";
const modalStack: string[] = [];

export function useModalHistory(isOpen: boolean, onClose: () => void) {
  const runtime = useMerchantRuntime();
  const scope = runtime?.scope;
  const isActive = runtime?.active;
  const modalId = useId();
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen || isActive?.() === false) {
      isClosingRef.current = false;
      return;
    }

    const handlePopState = () => {
      if (modalStack.at(-1) !== modalId || window.history.state?.merchantModal === modalId) return;
      if (isClosingRef.current || isActive?.() === false) return;
      isClosingRef.current = true;
      onCloseRef.current();
    };

    window.history.pushState({ ...window.history.state, key: MODAL_STATE_KEY, merchantModal: modalId, merchantScope: scope }, "");
    modalStack.push(modalId);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      const index = modalStack.lastIndexOf(modalId);
      if (index >= 0) modalStack.splice(index, 1);
      if (isActive?.() !== false && window.history.state?.merchantModal === modalId && window.history.state?.merchantScope === scope) {
        window.history.back();
      }
      isClosingRef.current = false;
    };
  }, [isOpen, modalId, scope, isActive]);

  const handleCloseAndPop = () => {
    if (isClosingRef.current || isActive?.() === false) return;
    if (window.history.state?.merchantModal === modalId && window.history.state?.merchantScope === scope) {
      window.history.back();
    } else {
      isClosingRef.current = true;
      onCloseRef.current();
    }
  };

  return { handleCloseAndPop };
}
