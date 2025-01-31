import { http, cookieStorage, createConfig, createStorage } from 'wagmi'
import { baseSepolia, base } from 'wagmi/chains'
import { coinbaseWallet } from 'wagmi/connectors'

export function getConfig() {
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [
      coinbaseWallet({ preference: "smartWalletOnly" }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
    },
  })
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
