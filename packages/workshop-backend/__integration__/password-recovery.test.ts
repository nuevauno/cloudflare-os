import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const oldHash = new Uint8Array(32).fill(7)
const newHash = new Uint8Array(32).fill(9)

describe('password recovery', () => {
  it('uses a token once, replaces the password and invalidates prior sessions', async () => {
    const username = `recovery-${crypto.randomUUID()}@example.com`
    const user = exports.UserDurableObject.get(exports.UserDurableObject.idFromName(username))
    expect(await user.createAccount(username, 'Recovery', oldHash)).toBeTruthy()

    const token = await user.beginPasswordReset()
    expect(token).toBeTruthy()
    expect(await user.resetPassword(token!, newHash)).toBe(true)
    expect(await user.resetPassword(token!, oldHash)).toBe(false)
    expect(await user.login(oldHash)).toBeNull()
    expect(await user.login(newHash)).toBeTruthy()
  })

  it('rate limits repeated reset requests without creating a second token', async () => {
    const username = `recovery-rate-${crypto.randomUUID()}@example.com`
    const user = exports.UserDurableObject.get(exports.UserDurableObject.idFromName(username))
    await user.createAccount(username, 'Recovery', oldHash)
    expect(await user.beginPasswordReset()).toBeTruthy()
    expect(await user.beginPasswordReset()).toBeNull()
  })

  it('replacePassword overwrites an existing hash and revokes old sessions', async () => {
    const username = `recovery-replace-${crypto.randomUUID()}@example.com`
    const user = exports.UserDurableObject.get(exports.UserDurableObject.idFromName(username))
    const firstSession = await user.createAccount(username, 'Recovery', oldHash)
    expect(firstSession).toBeTruthy()
    const replacement = await user.replacePassword(newHash, { username, displayName: 'Felipe' })
    expect(replacement).toBeTruthy()
    expect(await user.login(oldHash)).toBeNull()
    expect(await user.login(newHash)).toBeTruthy()
    expect(await user.whoami()).toEqual({ type: 'user', name: 'Felipe', id: username })
  })
})
