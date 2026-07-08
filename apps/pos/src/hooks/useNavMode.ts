"use client";

import { useState, useEffect } from "react";

export type NavMode = "bottom" | "rail" | "sidebar";

const PHONE_MAX_WIDTH = 767;
const TABLET_MIN_WIDTH = 768;

export function useNavMode(): NavMode {
  const [mode, setMode] = useState<NavMode>("bottom");

  useEffect(() => {
    function getMode(): NavMode {
      const width = window.innerWidth;
      const orientationType = window.screen.orientation?.type;
      let isPortrait: boolean;
      let isLandscape: boolean;

      if (orientationType) {
        isPortrait = orientationType.includes("portrait");
        isLandscape = orientationType.includes("landscape");
      } else {
        isPortrait = window.innerWidth <= window.innerHeight;
        isLandscape = window.innerWidth > window.innerHeight;
      }

      if (width < PHONE_MAX_WIDTH) {
        if (isPortrait) return "bottom";
        if (isLandscape) return "rail";
      }
      return "sidebar";
    }

    function handleChange() {
      setMode(getMode());
    }

    setMode(getMode());

    const mqOrientation = window.matchMedia("(orientation: portrait)");
    mqOrientation.addEventListener("change", handleChange);

    const mqWidth = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`);
    mqWidth.addEventListener("change", handleChange);

    return () => {
      mqOrientation.removeEventListener("change", handleChange);
      mqWidth.removeEventListener("change", handleChange);
    };
  }, []);

  return mode;
}

export function useIsPhoneLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    function getLandscape(): boolean {
      const orientationType = window.screen.orientation?.type;
      if (orientationType) {
        return orientationType.includes("landscape");
      }
      return window.innerWidth > window.innerHeight;
    }

    function handleChange() {
      setIsLandscape(getLandscape());
    }

    setIsLandscape(getLandscape());
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  return isLandscape;
}
