declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.css'

declare module '*.png' {
  /** Inlined as a data URI by the build (esbuild dataurl loader). */
  const src: string
  export default src
}
