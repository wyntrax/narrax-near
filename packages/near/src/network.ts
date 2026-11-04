/** NEAR network selection. Testnet is the default so an unset or misspelled value can never point at mainnet. */
export type NearNetwork = 'mainnet' | 'testnet';

export function parseNearNetwork(value: string | undefined): NearNetwork {
  return value?.trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
}

export function defaultNearRpcUrl(network: NearNetwork): string {
  return network === 'mainnet' ? 'https://rpc.mainnet.near.org' : 'https://rpc.testnet.near.org';
}

export function nearNativeDecimals(): 24 {
  return 24;
}
