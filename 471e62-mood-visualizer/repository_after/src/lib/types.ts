export type ShapeType = 'circle' | 'triangle' | 'square' | 'pentagon' | 'hexagon';
export type AnimationType = 'rotate' | 'pulse' | 'bounce' | 'wave' | 'jitter';
export type PatternType = 'solid' | 'gradient' | 'striped' | 'dotted';

export interface ShapeProperties {
  type: ShapeType;
  primaryColor: string;
  secondaryColor: string;
  size: number;
  animation: AnimationType;
  speed: number;
  pattern: PatternType;
}

export interface MoodShape {
  id: string;
  mood: string;
  timestamp: number;
  properties: ShapeProperties;
}
