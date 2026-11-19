// jq-web ships no types: the part GLIDE4RMK uses (ADR 0025).
declare module "jq-web" {
  interface Jq {
    promised: { json(input: unknown, program: string): Promise<unknown> };
    onInitialized: { addListener(callback: () => void): void };
  }
  const jq: Jq;
  export default jq;
}
