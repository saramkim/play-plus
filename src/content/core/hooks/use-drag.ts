import { useState, useRef, useEffect } from 'react';

interface UseDragProps {
  onDrag: (x: number, y: number) => void;
}

export function useDrag({ onDrag }: UseDragProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  const maxCoordinate = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);

    if (!elementRef.current?.parentElement) return;

    const parentRect = elementRef.current.parentElement.getBoundingClientRect();
    const rect = elementRef.current.getBoundingClientRect();

    dragStartPos.current = {
      x: e.clientX + parentRect.left - rect.left,
      y: e.clientY + parentRect.top - rect.top,
    };
    maxCoordinate.current = {
      x: parentRect.width - rect.width,
      y: parentRect.height - rect.height,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;
    const { x: maxX, y: maxY } = maxCoordinate.current;

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
