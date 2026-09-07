import { Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import { AnonymousIdentity } from '@icp-sdk/core/agent';
// Imported only by Playwright's intercepted AuthClient import. Never in the app bundle.
// This replaces the human II gesture, not the signed canister API or persistent storage.
export class AuthClient {
  private identity=Ed25519KeyIdentity.generate(new Uint8Array(32).fill(Number(sessionStorage.getItem('test-identity-seed')??42)));
  isAuthenticated(){return sessionStorage.getItem('garage-test-signed-out')!=='yes';}
  async getIdentity(){return this.isAuthenticated()?this.identity:new AnonymousIdentity();}
  async signIn(){if(sessionStorage.getItem('finish-test-cancel')){sessionStorage.removeItem('finish-test-cancel');throw new Error('Sign-in cancelled.');}sessionStorage.removeItem('garage-test-signed-out');return this.identity;}
  async signOut(){sessionStorage.setItem('garage-test-signed-out','yes');}
}
