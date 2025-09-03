/// <reference types="react-scripts" />

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: React.Key | null | undefined;
  }
}

declare module 'styled-components' {
  interface DefaultTheme {}
  
  type StyledComponent<C extends keyof JSX.IntrinsicElements | React.ComponentType<any>, T, O = {}, A = never> = 
    React.ComponentType<
      (C extends keyof JSX.IntrinsicElements ? JSX.IntrinsicElements[C] : 
       C extends React.ComponentType<infer P> ? P : never) &
      O &
      (A extends never ? {} : { as?: A | keyof JSX.IntrinsicElements })
    >;
}