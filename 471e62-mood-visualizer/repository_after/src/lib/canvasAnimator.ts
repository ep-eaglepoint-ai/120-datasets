import { ShapeProperties } from './types';

export class ShapeAnimator {
  private animationFrame: number | null = null;
  private startTime: number = Date.now();
  private ctx: CanvasRenderingContext2D | null;

  constructor(
    private canvas: HTMLCanvasElement,
    private properties: ShapeProperties
  ) {
    this.ctx = canvas.getContext('2d');
  }

  start(): void {
    this.animate();
  }

  stop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private animate = (): void => {
    if (!this.ctx) return;
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    
    this.applyAnimation(elapsed);
    this.drawShape();
    
    this.ctx.restore();
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private applyAnimation(elapsed: number): void {
    if (!this.ctx) return;
    
    const { animation, speed } = this.properties;
    const factor = elapsed * speed;
    
    switch (animation) {
      case 'rotate':
        this.ctx.rotate(factor);
        break;
      case 'pulse': {
        const scale = 1 + Math.sin(factor) * 0.2;
        this.ctx.scale(scale, scale);
        break;
      }
      case 'bounce': {
        const offsetY = Math.abs(Math.sin(factor)) * 30;
        this.ctx.translate(0, -offsetY);
        break;
      }
      case 'wave': {
        const offsetX = Math.sin(factor) * 20;
        this.ctx.translate(offsetX, 0);
        break;
      }
      case 'jitter': {
        const offsetX = (Math.random() - 0.5) * 5;
        const offsetY = (Math.random() - 0.5) * 5;
        this.ctx.translate(offsetX, offsetY);
        break;
      }
    }
  }

  private drawShape(): void {
    if (!this.ctx) return;
    
    const { type, size, pattern, primaryColor, secondaryColor, animation } = this.properties;
    
    this.ctx.save();
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = primaryColor + '40';
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.beginPath();
    
    switch (type) {
      case 'circle':
        this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        break;
      case 'triangle':
        this.drawPolygon(3, size / 2);
        break;
      case 'square':
        this.ctx.rect(-size / 2, -size / 2, size, size);
        break;
      case 'pentagon':
        this.drawPolygon(5, size / 2);
        break;
      case 'hexagon':
        this.drawPolygon(6, size / 2);
        break;
    }
    
    this.applyPattern(pattern, primaryColor, secondaryColor);
    this.ctx.fill();
    this.ctx.restore();
    
    this.ctx.save();
    const strokeWidth = animation === 'jitter' ? 3 : animation === 'pulse' ? 2.5 : 2;
    this.ctx.lineWidth = strokeWidth;
    const strokeColor = this.getExpressiveStrokeColor(animation);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    
    this.ctx.beginPath();
    switch (type) {
      case 'circle':
        this.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        break;
      case 'triangle':
        this.drawPolygon(3, size / 2);
        break;
      case 'square':
        this.ctx.rect(-size / 2, -size / 2, size, size);
        break;
      case 'pentagon':
        this.drawPolygon(5, size / 2);
        break;
      case 'hexagon':
        this.drawPolygon(6, size / 2);
        break;
    }
    this.ctx.stroke();
    this.drawInnerAccents(type, size, primaryColor, secondaryColor);
    this.ctx.restore();
  }

  private getExpressiveStrokeColor(animation: string): string {
    switch (animation) {
      case 'jitter':
        return '#dc2626'; // Red for anxious/energetic
      case 'pulse':
        return '#059669'; // Green for calm/breathing
      case 'bounce':
        return '#2563eb'; // Blue for playful
      case 'wave':
        return '#7c3aed'; // Purple for flowing
      case 'rotate':
        return '#ea580c'; // Orange for dynamic
      default:
        return '#1e293b'; // Slate for neutral
    }
  }

  private drawInnerAccents(
    type: string,
    size: number,
    primaryColor: string,
    secondaryColor: string
  ): void {
    if (!this.ctx) return;
    
    this.ctx.save();
    const innerSize = size * 0.4;
    
    switch (type) {
      case 'circle':
        this.ctx.beginPath();
        this.ctx.arc(0, 0, innerSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = secondaryColor + '60';
        this.ctx.fill();
        break;
      case 'triangle':
        this.ctx.beginPath();
        this.drawPolygon(3, innerSize / 2);
        this.ctx.fillStyle = secondaryColor + '50';
        this.ctx.fill();
        break;
      case 'square':
        this.ctx.rotate(Math.PI / 4);
        this.ctx.beginPath();
        this.ctx.rect(-innerSize / 2, -innerSize / 2, innerSize, innerSize);
        this.ctx.fillStyle = secondaryColor + '50';
        this.ctx.fill();
        break;
      case 'pentagon':
        this.ctx.beginPath();
        this.drawPolygon(5, innerSize / 2);
        this.ctx.fillStyle = secondaryColor + '50';
        this.ctx.fill();
        break;
      case 'hexagon':
        this.ctx.beginPath();
        this.drawPolygon(6, innerSize / 2);
        this.ctx.fillStyle = secondaryColor + '50';
        this.ctx.fill();
        break;
    }
    
    this.ctx.restore();
  }

  private drawPolygon(sides: number, radius: number): void {
    if (!this.ctx) return;
    
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
  }

  private applyPattern(
    pattern: ShapeProperties['pattern'],
    primaryColor: string,
    secondaryColor: string
  ): void {
    if (!this.ctx) return;
    
    switch (pattern) {
      case 'solid':
        this.ctx.fillStyle = primaryColor;
        break;
      case 'gradient': {
        const gradient = this.ctx.createLinearGradient(
          -this.properties.size / 2,
          -this.properties.size / 2,
          this.properties.size / 2,
          this.properties.size / 2
        );
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, secondaryColor);
        this.ctx.fillStyle = gradient;
        break;
      }
      case 'striped': {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 10;
        patternCanvas.height = 10;
        const patternCtx = patternCanvas.getContext('2d');
        if (patternCtx) {
          patternCtx.fillStyle = primaryColor;
          patternCtx.fillRect(0, 0, 10, 10);
          patternCtx.fillStyle = secondaryColor;
          patternCtx.fillRect(0, 0, 5, 10);
          const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
          if (pattern) this.ctx.fillStyle = pattern;
        }
        break;
      }
      case 'dotted': {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 20;
        patternCanvas.height = 20;
        const patternCtx = patternCanvas.getContext('2d');
        if (patternCtx) {
          patternCtx.fillStyle = primaryColor;
          patternCtx.fillRect(0, 0, 20, 20);
          patternCtx.fillStyle = secondaryColor;
          patternCtx.beginPath();
          patternCtx.arc(10, 10, 3, 0, Math.PI * 2);
          patternCtx.fill();
          const pattern = this.ctx.createPattern(patternCanvas, 'repeat');
          if (pattern) this.ctx.fillStyle = pattern;
        }
        break;
      }
    }
  }
}
