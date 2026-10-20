import {
  decodeEventLog, encodeFunctionData, keccak256, parseAbiItem, toBytes,
  type TransactionReceipt,
} from 'viem';

// Silvi sponsorship rail — SilviProtocol/silvi contracts (MIT):
// ResearchSponsorshipPayment collects exactly 3 USDC per species and
// emits SponsorshipReceived; their backend then triggers research and
// mints a ContreebutionNFT to the sender. A Springforth donation can
// settle on this rail: the donation's settlementRef becomes the
// sponsorship tx hash via the normal POST /chain/record flow.
//
// Contract addresses are NOT public in their repo (env-configured
// upstream) — callers pass them explicitly via env.

// sponsorSpecies(string taxon_id) — pulls 3 USDC via transferFrom, so
// the signer must approve(spender, 3e6) first (buildErc20ApproveTx).
const SPONSOR_ABI = [{
  name: 'sponsorSpecies', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'taxon_id', type: 'string' }],
  outputs: [],
}] as const;

const ERC20_APPROVE_ABI = [{
  name: 'approve', type: 'function', stateMutability: 'nonpayable',
  inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

// SponsorshipReceived(address indexed sender, string taxon_id,
// uint256 amount, string transaction_hash) — non-indexed args in data.
const SPONSORED_EVENT = parseAbiItem(
  'event SponsorshipReceived(address indexed sender, string taxon_id, uint256 amount, string transaction_hash)');
const EVT_SPONSORED = keccak256(toBytes(
  'SponsorshipReceived(address,string,uint256,string)'));

export function buildErc20ApproveTx(opts: {
  token: `0x${string}`; spender: `0x${string}`; amount: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: opts.token,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI, functionName: 'approve',
      args: [opts.spender, opts.amount],
    }),
  };
}

// The 3-USDC species sponsorship call. Signer = sponsor (donor).
export function buildSponsorSpeciesTx(opts: {
  contract: `0x${string}`; taxonId: string;
}): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: opts.contract,
    data: encodeFunctionData({
      abi: SPONSOR_ABI, functionName: 'sponsorSpecies',
      args: [opts.taxonId],
    }),
  };
}

export interface SilviSponsorship {
  sender: `0x${string}`; taxonId: string; amount: bigint;
}

// Decode the SponsorshipReceived log from a receipt — confirms both the
// payment and which species it funded.
export function parseSilviSponsorship(
  receipt: TransactionReceipt, contract: `0x${string}`,
): SilviSponsorship | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
    if (log.topics[0] !== EVT_SPONSORED) continue;
    try {
      const d = decodeEventLog({
        abi: [SPONSORED_EVENT], data: log.data, topics: log.topics,
      });
      const a = d.args as { sender?: `0x${string}`; taxon_id?: string; amount?: bigint };
      if (a.sender && a.taxon_id !== undefined && a.amount !== undefined)
        return { sender: a.sender, taxonId: a.taxon_id, amount: a.amount };
    } catch { /* not this event */ }
  }
  return null;
}
