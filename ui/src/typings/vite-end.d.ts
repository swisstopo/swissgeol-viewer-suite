interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_OGC_GST_BASIC_AUTH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
