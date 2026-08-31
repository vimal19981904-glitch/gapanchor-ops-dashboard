import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'microsoft',
      name: 'Microsoft Outlook',
      type: 'oauth',
      wellKnown: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/v2.0/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: 'openid profile email Mail.Read Calendars.Read offline_access',
        },
      },
      clientId: process.env.MICROSOFT_CLIENT_ID || 'dummy_client_id',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'dummy_client_secret',
      idToken: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email || profile.preferred_username,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'gapanchor-ops-dashboard-secret-change-in-prod',
};
