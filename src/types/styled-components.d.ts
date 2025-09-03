declare module '*.tsx' {
  namespace JSX {
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}

declare module 'styled-components' {
  import { DefaultTheme as StyledDefaultTheme } from 'styled-components/dist/types';
  
  export interface DefaultTheme extends StyledDefaultTheme {}
  
  export const ThemeProvider: React.ComponentType<{
    theme: any;
    children: React.ReactNode;
  }>;
  
  type StyledComponent<C, T = DefaultTheme, O = {}, A = never> = React.ComponentType<any>;
}
