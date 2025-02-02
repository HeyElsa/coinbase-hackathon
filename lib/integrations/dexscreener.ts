export async function getLatestMemeCoins() {
    type Coin = {
        chainId: string;
        tokenAddress: string;
        symbol: string;
    }
    return (await fetch(`https://api.dexscreener.com/token-profiles/latest/v1`)).json() as Promise<Array<Coin>>;
}
