declare module "pdfjs-dist/build/pdf.worker.mjs" {
  const worker: string;
  export default worker;
}

declare module "*.worker.js" {
  const worker: string;
  export default worker;
}

declare module "*.mjs" {
  const value: string;
  export default value;
}