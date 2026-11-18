import { useEffect } from 'react';

let activeLocks = 0;
let savedScrollY = 0;
let prevBodyStyle: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  overscrollBehavior: string;
} | null = null;
let prevHtmlOverscroll = '';

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof window === 'undefined') return;

    if (activeLocks === 0) {
      savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const body = document.body;
      const html = document.documentElement;
      prevBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        overscrollBehavior: body.style.overscrollBehavior,
      };
      prevHtmlOverscroll = html.style.overscrollBehavior;

      html.style.overscrollBehavior = 'none';
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0 && prevBodyStyle) {
        const body = document.body;
        const html = document.documentElement;
        html.style.overscrollBehavior = prevHtmlOverscroll;
        body.style.position = prevBodyStyle.position;
        body.style.top = prevBodyStyle.top;
        body.style.left = prevBodyStyle.left;
        body.style.right = prevBodyStyle.right;
        body.style.width = prevBodyStyle.width;
        body.style.overflow = prevBodyStyle.overflow;
        body.style.overscrollBehavior = prevBodyStyle.overscrollBehavior;
        prevBodyStyle = null;
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [locked]);
}
