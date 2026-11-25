// Real-shaped requests. Token and protocol contracts are the real mainnet addresses.
// Wallet, spender, operator and recipient addresses are random and illustrative.
const WALLET = '0x744b5ad62ce607514dee3cc9350773fa8328da69';
const DRAINER = '0x5a2b415f649691263e0c42d50f7d8e2e7354646d';
const RECIPIENT = '0x24ede678908656e63b65ab87b90b9cb34e87af82';
const OPERATOR = '0xfba165c939af288af546b81fff6d81d96cd99fdc';

export interface Sample { id: string; title: string; hint: string; site: string; body: () => string }

const nowS = () => Math.floor(Date.now() / 1000);
const j = (o: unknown) => JSON.stringify(o, null, 2);

export const SAMPLES: Sample[] = [
  {
    id: 'permit2-claim',
    title: '“Claim your airdrop” on a rewards site',
    hint: 'Permit2 allowance',
    site: 'uniswap-rewards.example',
    body: () => j({
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
        PermitDetails: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
        PermitSingle: [{ name: 'details', type: 'PermitDetails' }, { name: 'spender', type: 'address' }, { name: 'sigDeadline', type: 'uint256' }],
      },
      domain: { name: 'Permit2', chainId: '1', verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
      primaryType: 'PermitSingle',
      message: {
        details: { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amount: '1461501637330902918203684832716283019655932542975', expiration: '281474976710655', nonce: '0' },
        spender: DRAINER,
        sigDeadline: String(nowS() + 1800),
      },
    }),
  },
  {
    id: 'seaport-zero',
    title: '“Free mint pass” that lists your ape',
    hint: 'Seaport order',
    site: 'bayc-mintpass.example',
    body: () => j({
      types: { OrderComponents: [{ name: 'offerer', type: 'address' }] },
      domain: { name: 'Seaport', version: '1.5', chainId: 1, verifyingContract: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC' },
      primaryType: 'OrderComponents',
      message: {
        offerer: WALLET,
        zone: '0x0000000000000000000000000000000000000000',
        offer: [{ itemType: '2', token: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', identifierOrCriteria: '8817', startAmount: '1', endAmount: '1' }],
        consideration: [{ itemType: '0', token: '0x0000000000000000000000000000000000000000', identifierOrCriteria: '0', startAmount: '1', endAmount: '1', recipient: RECIPIENT }],
        orderType: '0', startTime: String(nowS() - 60), endTime: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000', salt: '24446860302761739304752683030156737591518664810215442929818227897836383814680', conduitKey: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000', counter: '0',
      },
    }),
  },
  {
    id: 'usdc-permit',
    title: 'Paying 250 USDC through a swap router',
    hint: 'Bounded permit',
    site: 'app.uniswap.org',
    body: () => j({
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
        Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }],
      },
      domain: { name: 'USD Coin', version: '2', chainId: 1, verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      primaryType: 'Permit',
      message: { owner: WALLET, spender: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', value: '250000000', nonce: '4', deadline: String(nowS() + 1800) },
    }),
  },
  {
    id: 'nft-approval',
    title: '“Verify your holder role” for a Discord',
    hint: 'setApprovalForAll',
    site: 'azuki-holders.example',
    body: () => j({
      from: WALLET,
      to: '0xED5AF388653567Af2F388E6224dC7C4b3241C544',
      chainId: '0x1',
      value: '0x0',
      data: '0xa22cb465' + OPERATOR.slice(2).padStart(64, '0') + '1'.padStart(64, '0'),
    }),
  },
  {
    id: 'siwe-lookalike',
    title: 'OpenSea login on a look-alike site',
    hint: 'Sign-In with Ethereum',
    site: 'opensea-drops.example',
    body: () => [
      'opensea.io wants you to sign in with your Ethereum account:',
      WALLET,
      '',
      'Click to sign in and accept the OpenSea Terms of Service.',
      '',
      'URI: https://opensea.io/',
      'Version: 1',
      'Chain ID: 1',
      'Nonce: 8f2a1c9d0b7e4f36',
      `Issued At: ${new Date().toISOString()}`,
    ].join('\n'),
  },
];
