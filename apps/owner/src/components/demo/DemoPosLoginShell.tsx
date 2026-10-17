"use client";

import { useEffect } from "react";
import { ToastContainer } from "@rakku/ui";
import DemoControls from "./DemoControls";
import { useDemoSession } from "./DemoProvider";

export default function DemoPosLoginShell({ children }: { children: React.ReactNode }) {
  const { controller } = useDemoSession();
  useEffect(() => {
    if (controller.sandbox.getSnapshot().session.authenticated) controller.sandbox.run({ type: "session.switchUser" });
  }, [controller]);
  return <><DemoControls app="pos" auth />{children}<ToastContainer /></>;
}
