import { defineConfig } from 'orval';

export default defineConfig({
  lexic: {
    input: {
      target:
        'https://github.com/user-attachments/files/28140523/SwissTopoWebmapAPI-1.6.0.yaml',
    },
    output: {
      mode: 'split',
      client: 'fetch',
      target: 'src/features/lexic/generated/lexic-api.ts',
      schemas: 'src/features/lexic/generated/lexic-schemas',
      override: {
        mutator: {
          path: 'src/features/lexic/lexic-orval.mutator.ts',
          name: 'lexicFetch',
        },
      },
    },
  },
});
