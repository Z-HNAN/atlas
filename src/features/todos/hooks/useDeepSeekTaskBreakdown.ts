import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserApiKeyStore } from "../../../lib/api-keys/api-key-store";
import { toAppError } from "../../../lib/errors/app-error";
import { DeepSeekTaskBreakdownProvider } from "../providers/deepseek-task-breakdown-provider";

export const useDeepSeekTaskBreakdown = () => {
  const storeRef = useRef<BrowserApiKeyStore | null>(null);
  storeRef.current ??= new BrowserApiKeyStore();
  const providerRef = useRef<DeepSeekTaskBreakdownProvider | null>(null);
  providerRef.current ??= new DeepSeekTaskBreakdownProvider();
  const abortRef = useRef<AbortController | null>(null);
  const [hasKey, setHasKey] = useState(() =>
    Boolean(storeRef.current?.get("deepseek")),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const saveKey = useCallback((apiKey: string, remember: boolean) => {
    try {
      if (remember) storeRef.current?.setPersistent("deepseek", apiKey);
      else storeRef.current?.setSession("deepseek", apiKey);
      setHasKey(true);
      setError("");
      return { ok: true as const };
    } catch (caught) {
      const appError = toAppError(caught, "DeepSeek API Key 保存失败。");
      setError(appError.message);
      return { ok: false as const, error: appError.message };
    }
  }, []);

  const clearKey = useCallback(() => {
    try {
      abortRef.current?.abort();
      storeRef.current?.remove("deepseek");
      setHasKey(false);
      setError("");
    } catch (caught) {
      setError(toAppError(caught, "DeepSeek API Key 清除失败。").message);
    }
  }, []);

  const breakdown = useCallback(async (title: string, notes: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await providerRef.current!.execute(
        { title, notes },
        {
          apiKey: storeRef.current?.get("deepseek") ?? undefined,
          signal: controller.signal,
        },
      );
      return { ok: true as const, value: result.subtasks };
    } catch (caught) {
      const appError = toAppError(caught, "DeepSeek 任务拆解失败。");
      setError(appError.message);
      return { ok: false as const, error: appError.message };
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  return { hasKey, loading, error, saveKey, clearKey, breakdown };
};
