'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import '@/app/system-visibility.css';

// ============================================================================
// SIDDHANT: SystemTooltip
//
// Contextual explanation component for platform concepts.
// Desktop: hover popover (200ms delay)
// Mobile:  tap → bottom sheet overlay
//
// Design: institutional, restrained, 1-sentence max.
// ============================================================================

interface SystemTooltipProps {
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Short title (serif, bold) */
  title: string;
  /** One-sentence explanation — 2 lines max */
  text: string;
  /** Optional "Learn more" URL */
  learnMoreHref?: string;
  /** Disable tooltip (passthrough mode) */
  disabled?: boolean;
}

const MOBILE_BREAKPOINT = 768;

export default function SystemTooltip({
  children,
  title,
  text,
  learnMoreHref,
  disabled = false,
}: SystemTooltipProps) {
  const [isDesktopVisible, setIsDesktopVisible] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isMobile || disabled) return;
    hoverTimeout.current = setTimeout(() => setIsDesktopVisible(true), 200);
  }, [isMobile, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsDesktopVisible(false);
  }, []);

  const handleTap = useCallback(() => {
    if (!isMobile || disabled) return;
    setIsMobileOpen(true);
  }, [isMobile, disabled]);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={wrapperRef}
        className="sys-tooltip-wrapper"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTap}
      >
        <span className="sys-tooltip-trigger">
          {children}
        </span>

        {/* Desktop popover */}
        {!isMobile && (
          <div className={`sys-tooltip-popover ${isDesktopVisible ? 'visible' : ''}`}>
            <div className="sys-tooltip-title">{title}</div>
            <div className="sys-tooltip-text">{text}</div>
            {learnMoreHref && (
              <a href={learnMoreHref} className="sys-tooltip-link" onClick={e => e.stopPropagation()}>
                Learn more →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && isMobileOpen && (
        <>
          <div className="sys-bottomsheet-overlay" onClick={closeMobile} />
          <div className="sys-bottomsheet">
            <div className="sys-bottomsheet-handle" />
            <div className="sys-bottomsheet-title">{title}</div>
            <div className="sys-bottomsheet-text">{text}</div>
            {learnMoreHref && (
              <a
                href={learnMoreHref}
                className="sys-tooltip-link"
                style={{ marginTop: '12px', fontSize: '0.72rem' }}
              >
                Learn more →
              </a>
            )}
          </div>
        </>
      )}
    </>
  );
}
