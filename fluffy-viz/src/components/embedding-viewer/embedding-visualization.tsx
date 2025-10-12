'use client';

/**
 * Embedding visualization using embedding-atlas
 * Renders an interactive scatter plot of embedded points
 */

import { useEffect, useRef } from 'react';
import type { ActiveEmbeddingLayer, EmbeddingPoint } from '@/types/embedding';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  onPointClick: (point: EmbeddingPoint) => void;
}

export function EmbeddingVisualization({ layer, onPointClick }: EmbeddingVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const atlasRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // For now, use fallback canvas visualization
    // TODO: Integrate embedding-atlas properly with Next.js webpack config
    renderFallbackVisualization();

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, onPointClick]);

  const renderFallbackVisualization = () => {
    if (!containerRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;
    containerRef.current.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of layer.points) {
      const [x, y] = point.coordinates2D;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 50;

    // Draw points
    ctx.fillStyle = '#3b82f6';
    for (const point of layer.points) {
      const [x, y] = point.coordinates2D;
      const screenX = padding + ((x - minX) / rangeX) * (canvas.width - 2 * padding);
      const screenY = padding + ((y - minY) / rangeY) * (canvas.height - 2 * padding);

      ctx.beginPath();
      ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add click handler
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Find closest point
      let closestPoint: EmbeddingPoint | null = null;
      let closestDist = Infinity;

      for (const point of layer.points) {
        const [x, y] = point.coordinates2D;
        const screenX = padding + ((x - minX) / rangeX) * (canvas.width - 2 * padding);
        const screenY = padding + ((y - minY) / rangeY) * (canvas.height - 2 * padding);

        const dist = Math.sqrt((screenX - clickX) ** 2 + (screenY - clickY) ** 2);
        if (dist < closestDist && dist < 10) {
          closestDist = dist;
          closestPoint = point;
        }
      }

      if (closestPoint) {
        onPointClick(closestPoint);
      }
    });
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}
