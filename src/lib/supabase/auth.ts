import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "../errors/app-error";

const magicLinkInputSchema = z
  .object({
    email: z.string().trim().email(),
    emailRedirectTo: z.string().url(),
  })
  .strict();

export interface SupabaseAuthClientLike {
  getSession(): Promise<{
    data: { session: Session | null };
    error: unknown;
  }>;
  signInWithOtp(input: {
    email: string;
    options: { emailRedirectTo: string };
  }): Promise<{ error: unknown }>;
  signOut(): Promise<{ error: unknown }>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
}

export interface CloudAuthGateway {
  getSession(): Promise<Session | null>;
  sendMagicLink(email: string, emailRedirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  subscribe(listener: (session: Session | null) => void): () => void;
}

export class SupabaseCloudAuthGateway implements CloudAuthGateway {
  constructor(private readonly auth: SupabaseAuthClientLike) {}

  static fromClient(client: SupabaseClient) {
    return new SupabaseCloudAuthGateway(client.auth);
  }

  async getSession() {
    const { data, error } = await this.auth.getSession();
    if (error) {
      throw new AppError("NETWORK_ERROR", "Supabase 登录会话读取失败。", error);
    }
    return data.session;
  }

  async sendMagicLink(email: string, emailRedirectTo: string) {
    const parsed = magicLinkInputSchema.safeParse({ email, emailRedirectTo });
    if (!parsed.success) {
      throw new AppError(
        "DATA_VALIDATION_FAILED",
        "邮箱或登录回调地址格式不正确。",
        parsed.error,
      );
    }
    const { error } = await this.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: parsed.data.emailRedirectTo },
    });
    if (error) {
      throw new AppError("NETWORK_ERROR", "登录邮件发送失败。", error);
    }
  }

  async signOut() {
    const { error } = await this.auth.signOut();
    if (error) {
      throw new AppError("NETWORK_ERROR", "Supabase 退出登录失败。", error);
    }
  }

  subscribe(listener: (session: Session | null) => void) {
    const { data } = this.auth.onAuthStateChange((_event, session) => {
      listener(session);
    });
    return () => data.subscription.unsubscribe();
  }
}
