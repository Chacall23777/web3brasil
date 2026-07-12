import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Lang = "pt" | "en";

const STORAGE_KEY = "w3b_lang";

const dict = {
  pt: {
    "nav.home": "Início",
    "nav.community": "Comunidade",
    "nav.team": "Equipe",
    "nav.verify": "Verificar-se",
    "nav.admin": "Admin",
    "nav.signin": "Entrar",
    "nav.signout": "Sair",
    "nav.profile": "Perfil",
    "community.title": "Comunidade",
    "community.tab.foryou": "Para você",
    "community.tab.hot": "Em alta",
    "community.tab.recent": "Recentes",
    "post.comment": "Comentar",
    "post.comments": "Comentários",
    "post.edit": "Editar",
    "post.delete": "Apagar",
    "post.save": "Salvar",
    "post.cancel": "Cancelar",
    "post.confirmDelete": "Apagar postagem?",
    "post.edited": "editado",
    "post.autoTranslated": "Traduzido automaticamente",
    "post.viewOriginal": "ver original",
    "post.viewTranslation": "ver tradução",
    "post.translationUnavailable": "Tradução indisponível no momento — exibindo original.",
    "post.title": "Título",
    "post.content": "Conteúdo",
    "post.publish": "Publicar",
    "post.publishing": "Publicando…",
    "post.new.title": "Título (opcional)",
    "post.new.content": "O que você quer compartilhar?",
    "post.new.signInCta": "Entre com Google",
    "post.new.signInSuffix": "para postar na comunidade.",
    "post.new.tabText": "Postagem",
    "post.new.tabToken": "Postar Token",
    "post.new.commentPlaceholder": "Escreva um comentário…",
    "post.new.commentSend": "Enviar",
    "post.new.noComments": "Nenhum comentário ainda.",
    "post.new.signInToComment": "para comentar.",
    "profile.title": "Meu perfil",
    "profile.language": "Idioma",
    "profile.languageHint": "Define o idioma da interface e a tradução automática dos posts.",
    "profile.save": "Salvar",
    "profile.saving": "Salvando…",
    "profile.saved": "Perfil salvo",
    "lang.pt": "Português",
    "lang.en": "Inglês",
    "lang.switch": "Idioma",
  },
  en: {
    "nav.home": "Home",
    "nav.community": "Community",
    "nav.team": "Team",
    "nav.verify": "Get verified",
    "nav.admin": "Admin",
    "nav.signin": "Sign in",
    "nav.signout": "Sign out",
    "nav.profile": "Profile",
    "community.title": "Community",
    "community.tab.foryou": "For You",
    "community.tab.hot": "Hot",
    "community.tab.recent": "Recent",
    "post.comment": "Comment",
    "post.comments": "Comments",
    "post.edit": "Edit",
    "post.delete": "Delete",
    "post.save": "Save",
    "post.cancel": "Cancel",
    "post.confirmDelete": "Delete post?",
    "post.edited": "edited",
    "post.autoTranslated": "Auto-translated",
    "post.viewOriginal": "view original",
    "post.viewTranslation": "view translation",
    "post.translationUnavailable": "Translation unavailable right now — showing original.",
    "post.title": "Title",
    "post.content": "Content",
    "post.publish": "Publish",
    "post.publishing": "Publishing…",
    "post.new.title": "Title (optional)",
    "post.new.content": "What do you want to share?",
    "post.new.signInCta": "Sign in with Google",
    "post.new.signInSuffix": "to post in the community.",
    "post.new.tabText": "Post",
    "post.new.tabToken": "Post Token",
    "post.new.commentPlaceholder": "Write a comment…",
    "post.new.commentSend": "Send",
    "post.new.noComments": "No comments yet.",
    "post.new.signInToComment": "to comment.",
    "profile.title": "My profile",
    "profile.language": "Language",
    "profile.languageHint": "Sets the interface language and auto-translation of posts.",
    "profile.save": "Save",
    "profile.saving": "Saving…",
    "profile.saved": "Profile saved",
    "lang.pt": "Portuguese",
    "lang.en": "English",
    "lang.switch": "Language",
  },
} as const;

type Key = keyof typeof dict.pt;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

function initial(): Lang {
  if (typeof window === "undefined") return "pt";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "pt";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    const pref = profile?.preferred_language;
    if (pref === "pt" || pref === "en") {
      setLangState(pref);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, pref);
    }
  }, [profile?.preferred_language]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
      if (user) {
        void (supabase as any).from("profiles").update({ preferred_language: l }).eq("id", user.id);
      }
    },
    [user],
  );

  const t = useCallback((k: Key) => dict[lang][k] ?? dict.pt[k] ?? k, [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const v = useContext(I18nCtx);
  if (!v) throw new Error("useI18n must be inside I18nProvider");
  return v;
}

