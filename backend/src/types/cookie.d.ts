declare module 'cookie' {
  export interface CookieParseOptions {
    decode?(val: string): string;
  }

  export interface CookieSerializeOptions {
    encode?(val: string): string;
    maxAge?: number;
    domain?: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    priority?: 'low' | 'medium' | 'high';
    sameSite?: true | false | 'lax' | 'strict' | 'none';
    partitioned?: boolean;
  }

  export function parse(str: string, options?: CookieParseOptions): Record<string, string | undefined>;
  export function serialize(name: string, val: string, options?: CookieSerializeOptions): string;
}
