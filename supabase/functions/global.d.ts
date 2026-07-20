// Ambient declarations for Deno runtime in Supabase Edge Functions for IDE compatibility

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://*' {
  const content: any;
  export const createClient: any;
  export default content;
}

declare module 'https://esm.sh/*' {
  const content: any;
  export const createClient: any;
  export default content;
}
