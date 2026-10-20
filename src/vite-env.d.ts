/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Número de WhatsApp de la tienda en formato internacional, sin `+` ni
   * espacios. Si no se define, la demo funciona en modo copiar mensaje.
   */
  readonly VITE_STORE_WHATSAPP_NUMBER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
