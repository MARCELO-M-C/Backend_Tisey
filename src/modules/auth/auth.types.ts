export interface AuthTokenPayload {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedUser {
  id: bigint;
  username: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}
