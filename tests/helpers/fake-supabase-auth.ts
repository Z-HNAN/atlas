import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { SupabaseAuthClientLike } from "../../src/lib/supabase/auth";

export const testSession: Session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3_600,
  expires_at: 1_784_292_800,
  token_type: "bearer",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    aud: "authenticated",
    email: "user@example.com",
    created_at: "2026-07-17T08:00:00.000Z",
    updated_at: "2026-07-17T08:00:00.000Z",
  },
};

export class FakeSupabaseAuthClient implements SupabaseAuthClientLike {
  currentSession: Session | null = null;
  magicLinkInput: {
    email: string;
    options: { emailRedirectTo: string };
  } | null = null;
  signedOut = false;
  unsubscribed = false;
  private listener:
    | ((event: AuthChangeEvent, session: Session | null) => void)
    | null = null;

  getSession() {
    return Promise.resolve({
      data: { session: this.currentSession },
      error: null,
    });
  }

  signInWithOtp(input: {
    email: string;
    options: { emailRedirectTo: string };
  }) {
    this.magicLinkInput = input;
    return Promise.resolve({ error: null });
  }

  signOut() {
    this.signedOut = true;
    this.currentSession = null;
    this.listener?.("SIGNED_OUT", null);
    return Promise.resolve({ error: null });
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
    this.listener = callback;
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.unsubscribed = true;
          },
        },
      },
    };
  }

  establishSession(session: Session = testSession) {
    this.currentSession = session;
    this.listener?.("SIGNED_IN", session);
  }
}
