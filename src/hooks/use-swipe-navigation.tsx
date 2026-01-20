import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SWIPE_THRESHOLD = 80; // Minimum distance for swipe
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity
const EDGE_WIDTH = 30; // Edge zone for starting swipe (px from screen edge)

// Navigation order for swipe
const navigationOrder = [
  '/',
  '/content',
  '/audit',
  '/keywords',
  '/competitors',
  '/history',
];

export function useSwipeNavigation(enabled: boolean = true) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isEdgeSwipe = useRef<boolean>(false);

  const getCurrentIndex = useCallback(() => {
    return navigationOrder.indexOf(location.pathname);
  }, [location.pathname]);

  const navigateToPage = useCallback((direction: 'left' | 'right') => {
    const currentIndex = getCurrentIndex();
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (direction === 'left') {
      // Swipe left = next page
      nextIndex = currentIndex + 1;
    } else {
      // Swipe right = previous page
      nextIndex = currentIndex - 1;
    }

    if (nextIndex >= 0 && nextIndex < navigationOrder.length) {
      navigate(navigationOrder[nextIndex]);
    }
  }, [getCurrentIndex, navigate]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchStartTime.current = Date.now();
      
      // Check if swipe started from edge
      const screenWidth = window.innerWidth;
      isEdgeSwipe.current = 
        touch.clientX < EDGE_WIDTH || 
        touch.clientX > screenWidth - EDGE_WIDTH;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isEdgeSwipe.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const deltaTime = Date.now() - touchStartTime.current;

      // Calculate velocity
      const velocity = Math.abs(deltaX) / deltaTime;

      // Check if horizontal swipe (not vertical scroll)
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

      // Check if swipe meets threshold
      const meetsThreshold = 
        Math.abs(deltaX) > SWIPE_THRESHOLD && 
        velocity > SWIPE_VELOCITY_THRESHOLD &&
        isHorizontalSwipe;

      if (meetsThreshold) {
        if (deltaX > 0) {
          // Swiped right (go to previous)
          navigateToPage('right');
        } else {
          // Swiped left (go to next)
          navigateToPage('left');
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, navigateToPage]);

  // Return navigation info for UI feedback
  const currentIndex = getCurrentIndex();
  const canGoNext = currentIndex < navigationOrder.length - 1 && currentIndex !== -1;
  const canGoPrevious = currentIndex > 0;
  const currentPageName = navigationOrder[currentIndex] || '';

  return {
    canGoNext,
    canGoPrevious,
    currentIndex,
    totalPages: navigationOrder.length,
    currentPageName,
  };
}
