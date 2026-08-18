import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import * as cookie from 'cookie';

export const SESSION_COOKIE_NAME = 'mh_session';
export const CSRF_COOKIE_NAME = 'mh_csrf';
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'masjidhub-csrf-default-secret-key-32chars!!';

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  };
}

export function getCsrfCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false, // Accessible by client JS
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60,
  };
}

export function createCsrfToken(): string {
  const raw = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
  return `${raw}.${signature}`;
}

export function verifyCsrfToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [raw, signature] = parts;
  if (!raw || !signature) return false;
  const expected = crypto.createHmac('sha256', CSRF_SECRET).update(raw).digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function setAuthCookies(reply: FastifyReply, token: string, csrfToken: string) {
  reply.setCookie(SESSION_COOKIE_NAME, token, getCookieOptions());
  reply.setCookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

export function clearAuthCookies(reply: FastifyReply) {
  const isProd = process.env.NODE_ENV === 'production';
  reply.setCookie(SESSION_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd
  });
  reply.setCookie(CSRF_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd
  });
}

const securityPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Decorate Request with cookies container
  if (!fastify.hasRequestDecorator('cookies')) {
    fastify.decorateRequest('cookies', null);
  }

  // Decorate Reply with setCookie and clearCookie
  if (!fastify.hasReplyDecorator('setCookie')) {
    fastify.decorateReply('setCookie', function (name: string, value: string, options: any = {}) {
      const serialized = cookie.serialize(name, value, options);
      const current = this.getHeader('set-cookie') || this.getHeader('Set-Cookie');
      if (!current) {
        this.header('Set-Cookie', serialized);
      } else if (Array.isArray(current)) {
        this.header('Set-Cookie', [...current, serialized]);
      } else {
        this.header('Set-Cookie', [current as string, serialized]);
      }
      return this;
    });
  }

  if (!fastify.hasReplyDecorator('clearCookie')) {
    fastify.decorateReply('clearCookie', function (name: string, options: any = {}) {
      const isProd = process.env.NODE_ENV === 'production';
      return (this as any).setCookie(name, '', {
        path: '/',
        ...options,
        maxAge: 0,
        expires: new Date(0),
        secure: isProd
      });
    });
  }

  // Decorate Fastify instance with helpers
  fastify.decorate('createCsrfToken', createCsrfToken);
  fastify.decorate('verifyCsrfToken', verifyCsrfToken);
  fastify.decorate('setAuthCookies', setAuthCookies);
  fastify.decorate('clearAuthCookies', clearAuthCookies);

  // Cookie parsing hook
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const rawCookie = request.raw.headers.cookie;
    (request as any).cookies = rawCookie ? cookie.parse(rawCookie) : {};
  });

  // Global CSRF Protection Hook on state-changing mutations
  const publicMutationExemptions = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/platform/auth/login',
    '/api/auth/logout',
    '/api/platform/auth/logout'
  ];

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutationMethods.includes(method)) return;

    // If request carries mh_session cookie, CSRF validation is strictly enforced
    const sessionCookie = request.cookies?.[SESSION_COOKIE_NAME];
    if (sessionCookie) {
      const path = request.url.split('?')[0];
      if (publicMutationExemptions.includes(path)) {
        return;
      }

      const headerVal = request.headers['x-csrf-token'] || request.headers['x-xsrf-token'];
      const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;

      if (!token || !verifyCsrfToken(token)) {
        reply.status(403).send({ error: 'Invalid or missing CSRF token.' });
        return;
      }
    }
  });
};

export default fp(securityPlugin);
