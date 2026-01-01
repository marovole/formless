import { test as base } from '@playwright/test'

export type ChatFixtures = {
  chatPage: string
}

export const test = base.extend<ChatFixtures>({
  chatPage: async ({}, use) => {
    await use('/zh/chat')
  },
})

export const expect = test.expect
