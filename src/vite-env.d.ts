/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Número de WhatsApp de la tienda en formato internacional, sin `+` ni
   * espacios. Si no se define, la demo funciona en modo copiar mensaje.
   */
  readonly VITE_STORE_WHATSAPP_NUMBER?: string
  /** Public Supabase project URL; only used by the prepared browser gateway. */
  readonly VITE_SUPABASE_URL?: string
  /** Publishable/anon key only. Never put the service role key in a VITE_ variable. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
