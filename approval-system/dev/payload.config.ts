import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { approvalSystem } from 'approval-system'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { devUser } from './helpers/credentials.js'
import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

export default buildConfig({
  admin: {
    autoLogin: devUser,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: 'documents',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'content', type: 'textarea' },

        {
          name: 'approvalFlow',
          type: 'array',
          fields: [
            { name: 'level', type: 'number' },
            {
              name: 'status',
              type: 'select',
              defaultValue: 'pending',
              options: ['pending', 'approved', 'rejected'],
            },
            { name: 'reviewedBy', type: 'relationship', relationTo: 'users' },
            { name: 'comment', type: 'textarea' },
            { name: 'timestamp', type: 'date' },
          ],
        },

        {
          name: 'currentApprovalLevel',
          type: 'number',
          defaultValue: 1,
        },

        {
          name: 'finalStatus',
          type: 'select',
          defaultValue: 'pending',
          options: ['pending', 'approved', 'rejected'],
        },
      ],
    },
  ],
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  onInit: async (payload) => {
    await seed(payload)
  },
  plugins: [
    approvalSystem({
      collections: {
        posts: true,
      },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
