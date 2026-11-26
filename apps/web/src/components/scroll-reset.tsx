"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * الانتقال إلى صفحة جديدة يبدأ من أعلاها. الترويسة والتذييل جزء من كل صفحة، فيرى Next.js الصفحة
 * الجديدة «ظاهرة» ويُبقي موضع التمرير القديم (أسفل الصفحة لمن ضغط رابطًا في التذييل).
 * الرجوع والتقدّم يُتركان للمتصفح ليعيد موضع الزائر، والرابط إلى قسم (#) يُترك لـNext.js.
 */
export function ScrollReset() {
  const pathname = usePathname();
  const historyMove = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    const onPop = () => {
      historyMove.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (historyMove.current) {
      historyMove.current = false;
      return;
    }
    if (window.location.hash === "") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
