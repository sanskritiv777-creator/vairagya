import { isNative } from "./platform";
import { supabase } from "@/integrations/supabase/client";

export const NATIVE_OAUTH_REDIRECT_URI =
  "app.vairagya://auth/callback";

export function getOAuthRedirectUri(): string {
  if (isNative()) {
    return NATIVE_OAUTH_REDIRECT_URI;
  }

  return `${window.location.origin}/auth/callback`;
}

function getCallbackParam(
  search: URLSearchParams,
  hash: URLSearchParams,
  key: string,
): string | null {
  return search.get(key) ?? hash.get(key);
}

export async function completeOAuthCallback(rawUrl: string) {
  const url = new URL(rawUrl);

  const search = url.searchParams;
  const hash = new URLSearchParams(
    url.hash.replace(/^#/, ""),
  );

  const oauthError =
    getCallbackParam(search, hash, "error_description") ??
    getCallbackParam(search, hash, "error");

  if (oauthError) {
    throw new Error(oauthError);
  }

  const code = search.get("code");

  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }
  } else {
    const accessToken = getCallbackParam(
      search,
      hash,
      "access_token",
    );

    const refreshToken = getCallbackParam(
      search,
      hash,
      "refresh_token",
    );

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        throw error;
      }
    }
  }

  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw new Error(
      "Google sign-in completed, but no Vairagya session was created.",
    );
  }

  return data.session;
}
