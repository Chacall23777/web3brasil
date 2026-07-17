let _web3: any | undefined;
let _spl: any | undefined;
async function loadWeb3(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_web3) return _web3;
  _web3 = await import("@solana/web3.js");
  return _web3;
}
async function loadSpl(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_spl) return _spl;
  _spl = await import("@solana/spl-token");
  return _spl;
