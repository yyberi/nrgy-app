declare module 'vue-grid-layout-v3' {
  import type { DefineComponent } from 'vue';

  export interface LayoutItem {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string | number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    isDraggable?: boolean;
    isResizable?: boolean;
    static?: boolean;
  }

  export interface GridLayoutProps {
    layout: LayoutItem[];
    colNum?: number;
    rowHeight?: number;
    isDraggable?: boolean;
    isResizable?: boolean;
    verticalCompact?: boolean;
    useCssTransforms?: boolean;
    responsive?: boolean;
    autoSize?: boolean;
    margin?: [number, number];
    isBounded?: boolean;
  }

  export interface GridItemProps extends LayoutItem {
    isDraggable?: boolean;
    isResizable?: boolean;
    static?: boolean;
  }

  export const GridLayout: DefineComponent<GridLayoutProps>;
  export const GridItem: DefineComponent<GridItemProps>;
}
