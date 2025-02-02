export async function getLatestMemeCoins() {
    return (await fetch(`https://api.dexscreener.com/token-profiles/latest/v1`)).json() as Promise<Array<any>>;
}
