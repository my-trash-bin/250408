import type {
  BeforeChangeHook,
  TypeWithID,
} from 'node_modules/payload/dist/collections/config/types.js'
import type { CollectionConfig, Config, Plugin } from 'payload'

type RoleLevelMap = Record<string, number>

interface ApprovalSystemOptions {
  collection: string
  levels: RoleLevelMap
}

export const approvalSystem = ({ collection, levels }: ApprovalSystemOptions): Plugin => {
  return (config: Config): Config => {
    const targetCollection = (() => {
      const result = config.collections?.find((c) => c.slug === collection)
      if (!result) {
        config.collections ??= []
        const result: CollectionConfig = { slug: collection, fields: [] }
        config.collections.push(result)
        return result
      }
      return result
    })()

    // Add approval fields
    targetCollection.fields = [
      ...targetCollection.fields,
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
    ]

    // Add hooks
    targetCollection.hooks = {
      ...targetCollection.hooks,
      beforeChange: [...(targetCollection.hooks?.beforeChange || []), approvalHook(levels)],
    }

    return config
  }
}

interface Document extends TypeWithID {
  approvalFlow: ApprovalStep[]
  currentApprovalLevel: number
  finalStatus: 'approved' | 'pending' | 'rejected'
}

interface ApprovalStep {
  comment?: string
  level: number
  reviewedBy?: string
  status: 'approved' | 'pending' | 'rejected'
  timestamp?: string
}

export const approvalHook =
  (levels: Record<string, number>): BeforeChangeHook<Document> =>
  ({ data, originalDoc, req }) => {
    if (!req?.user) {
      throw new Error('User not authenticated')
    }

    const user = req.user
    const userLevel = levels[user.role]

    if (!originalDoc || !Array.isArray(originalDoc.approvalFlow)) {
      throw new Error('Original document or approvalFlow missing')
    }

    const originalApprovalFlow: ApprovalStep[] = originalDoc.approvalFlow

    const updatedIndex = originalApprovalFlow.findIndex((step) => step.level === userLevel)

    if (updatedIndex >= 0) {
      const newStatus = data.approvalFlow?.[updatedIndex]?.status
      if (!newStatus) {
        throw new Error('newState must be changed')
      }

      data.approvalFlow = [...originalApprovalFlow]
      data.approvalFlow[updatedIndex] = {
        ...originalApprovalFlow[updatedIndex],
        reviewedBy: user.id.toString(),
        status: newStatus,
        timestamp: new Date().toISOString(),
      }

      if (newStatus === 'approved') {
        const nextStep = originalApprovalFlow.find(
          (step) => step.level > userLevel && step.status === 'pending',
        )

        if (nextStep) {
          data.currentApprovalLevel = nextStep.level
        } else {
          data.finalStatus = 'approved'
        }
      }

      if (newStatus === 'rejected') {
        data.finalStatus = 'rejected'
      }
    }

    return data
  }
