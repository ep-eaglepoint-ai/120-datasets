import { useEffect, useRef } from 'react';
import { ShapeAnimator } from '../lib/canvasAnimator';
import { ShapeProperties } from '../lib/types';

interface ShapeCanvasProps {
  properties: ShapeProperties;
  width?: number;
  height?: number;
}

export function ShapeCanvas({ properties, width = 400, height = 400 }: ShapeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatorRef = useRef<ShapeAnimator | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animator = new ShapeAnimator(canvas, properties);
    animator.start();
    animatorRef.current = animator;

    return () => {
      animator.stop();
      animatorRef.current = null;
    };
  }, [properties]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-2 border-slate-300 rounded-xl shadow-lg bg-white hover:border-slate-400 transition-all duration-300"
      />
    </div>
  );
}
