import { afterEach, expect, it, vi } from 'vitest';
import { DelegationChain, Ed25519KeyIdentity, Ed25519PublicKey } from '@icp-sdk/core/identity';
import { Principal } from '@icp-sdk/core/principal';
import type { AuthClientStorage } from '@icp-sdk/auth/client';
import { signInOptions, signInError } from '../src/services/auth-options';

afterEach(() => { vi.unstubAllGlobals(); });

// Local protocol fixture, never a real II account or production canister call.
// Keep the actual AuthClient, signer decoding, key generation and persistence.
async function provider() {
  vi.resetModules();
  const events = new EventTarget();
  const clicks: { listener: EventListener; capture: boolean }[] = [];
  const issuer = Ed25519KeyIdentity.generate();
  const requests: Record<string, unknown>[] = [];
  const local = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
  const popup = {
    closed: false, focus() {}, close() { this.closed = true; },
    async postMessage(request: { id: string; method: string; params?: Record<string, string> }) {
      if (popup.closed) return;
      let result: unknown = 'ready';
      if (request.method === 'icrc34_delegation') {
        requests.push(request.params!);
        const publicKey = Ed25519PublicKey.fromDer(new Uint8Array(Buffer.from(request.params!.publicKey, 'base64')));
        const chain = await DelegationChain.create(issuer, publicKey, new Date(Date.now() + 3600_000));
        result = {
          publicKey: Buffer.from(chain.publicKey).toString('base64'),
          signerDelegation: chain.delegations.map(({ delegation, signature }) => ({
            delegation: { pubkey: Buffer.from(delegation.pubkey).toString('base64'), expiration: String(delegation.expiration) },
            signature: Buffer.from(signature).toString('base64'),
          })),
        };
      }
      const event = Object.assign(new Event('message'), {
        source: popup, origin: 'https://id.ai', data: { jsonrpc: '2.0', id: request.id, result },
      });
      events.dispatchEvent(event);
    },
  };
  vi.stubGlobal('window', {
    open: () => { popup.closed = false; return popup; }, focus() {},
    addEventListener(type: string, listener: EventListener, capture = false) {
      if (type === 'click') clicks.push({ listener, capture });
      else events.addEventListener(type, listener);
    },
    removeEventListener: events.removeEventListener.bind(events),
  });
  const { AuthClient } = await import('@icp-sdk/auth/client');
  const data = new Map<string, string | CryptoKeyPair>();
  const storage: AuthClientStorage = {
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); },
    remove: async key => { data.delete(key); },
  };
  const create = (derivationOrigin?: string) => new AuthClient({ identityProvider: 'https://id.ai/authorize', derivationOrigin, keyType: 'Ed25519', storage, idleOptions: { disableIdle: true } });
  const client = create();
  await client.getIdentity();
  return { client, issuer, requests, create, click<T>(operation: () => T): T {
    const event = new Event('click');
    clicks.filter(c => c.capture).forEach(c => c.listener(event));
    const result = operation();
    clicks.filter(c => !c.capture).forEach(c => c.listener(event));
    return result;
  } };
}

it('reproduces the scoped failure, then signs in, restores and signs out with the standard II response and real SDK', async () => {
  const p = await provider();
  await expect(p.click(() => p.client.signIn({ ...signInOptions, targets: [Principal.fromText('aaaaa-aa')] })))
    .rejects.toThrow('unscoped');
  expect(p.client.isAuthenticated()).toBe(false);
  // Let the SDK close the previous failed request's window before retrying.
  await new Promise(resolve => setTimeout(resolve, 250));
  const identity = await p.click(() => p.client.signIn(signInOptions));
  expect(identity.getPrincipal().toText()).toBe(p.issuer.getPrincipal().toText());
  expect(p.requests[1]).not.toHaveProperty('targets');
  expect(p.requests[1].maxTimeToLive).toBe(String(signInOptions.maxTimeToLive));
  const restored = p.create();
  expect((await restored.getIdentity()).getPrincipal().toText()).toBe(identity.getPrincipal().toText());
  expect(restored.isAuthenticated()).toBe(true);
  await restored.signOut();
  expect((await restored.getIdentity()).getPrincipal().isAnonymous()).toBe(true);
  // Use the same window fixture: the SDK's click coordinator is a module singleton.
  await new Promise(resolve => setTimeout(resolve, 250));
  const origin = 'https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net';
  const custom = p.create(origin); await custom.getIdentity();
  await p.click(() => custom.signIn(signInOptions));
  expect(p.requests.at(-1)!.icrc95DerivationOrigin).toBe(origin);
  expect(p.requests.at(-1)!).not.toHaveProperty('targets');
});

it('distinguishes blocked popups, cancellation, transport, session and storage failures without exposing payloads', () => {
  expect(signInError(new Error('Signer window could not be opened'))).toContain('Allow popups');
  expect(signInError(new Error('Channel was closed before a response was received'))).toContain('cancelled');
  expect(signInError(new Error('Communication channel could not be established within a reasonable time'))).toContain('II-CONNECTION');
  expect(signInError(new Error('Returned delegation is unscoped but scoped targets were requested'))).toContain('II-SESSION');
  expect(signInError(new Error('IndexedDB quota exceeded'))).toContain('II-STORAGE');
  expect(signInError({ privateKey: 'never-display-this' })).not.toContain('never-display-this');
});
