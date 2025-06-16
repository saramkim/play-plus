import { useState, useRef, useEffect } from 'react';

interface UseDragProps {
  onDrag: (x: number, y: number) => void;
}

export function useDrag({ onDrag }: UseDragProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);

    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();

    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;

    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    onDrag(Math.min(Math.max(0, newX), maxX), Math.min(Math.max(0, newY), maxY));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return {
    isDragging,
    elementRef,
    handleMouseDown,
  };
}
