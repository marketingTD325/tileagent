import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeIndicatorProps {
  canGoPrevious: boolean;
  canGoNext: boolean;
  currentIndex: number;
  totalPages: number;
}

export default function SwipeIndicator({ 
  canGoPrevious, 
  canGoNext, 
  currentIndex, 
  totalPages 
}: SwipeIndicatorProps) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm border shadow-sm">
      {/* Previous indicator */}
      <div className={`transition-opacity ${canGoPrevious ? 'opacity-100' : 'opacity-30'}`}>
        <ChevronLeft className="h-4 w-4" />
      </div>
      
      {/* Page dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalPages }).map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full transition-all ${
              i === currentIndex 
                ? 'w-4 bg-primary' 
                : 'w-1.5 bg-muted-foreground/40'
            }`}
          />
        ))}
      </div>
      
      {/* Next indicator */}
      <div className={`transition-opacity ${canGoNext ? 'opacity-100' : 'opacity-30'}`}>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}
