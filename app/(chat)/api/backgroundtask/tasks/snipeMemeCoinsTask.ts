import 'server-only';
import { BackgroundTask } from "@/lib/db/schema";
import { getLatestMemeCoins } from "@/lib/integrations/dexscreener";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient } from 'viem'
import { base } from 'viem/chains'
import { http } from 'viem'
import { Payload, spendPermissionAbi } from "@/lib/utils";
import { updateBackgroundTaskStatus } from "@/lib/db/queries";
import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";

export async function snipeMemeCoinsTask(task: BackgroundTask) {
    var log = "";
    try {
        console.log("snipeMemeCoinsTask");
        const client = createWalletClient({
            chain: base,
            transport: http()
        });
        if (task.type !== 'snipeMemeCoins' || !task.payload) throw Error("Invalid task");
        const payload: Payload = JSON.parse(task.payload);
        const privateKey = process.env.SPENDER_PRIVATE_KEY as `0x${string}`;
        const spender = privateKeyToAccount(privateKey);
        console.log(process.env.SPENDER_SEED_PHRASE);
        Coinbase.configure({apiKeyName: process.env.CDK_API_KEY_NAME as string, privateKey: process.env.CDK_API_SECRET as string});
        const spenderWallet = await Wallet.import({ mnemonicPhrase: process.env.SPENDER_SEED_PHRASE as string }, Coinbase.networks.BaseMainnet);
        const spendPermissionManagerAddress = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad';

        await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
        const spendPermissionArgs = [
            payload.account,
            payload.spender,
            payload.token,
            BigInt(payload.allowance),
            payload.period,
            payload.start,
            payload.end,
            BigInt(payload.salt),
            payload.extraData
        ]
        const approveHash = await client.writeContract({
            address: spendPermissionManagerAddress,
            abi: spendPermissionAbi,
            functionName: 'approveWithSignature',
            args: [
                spendPermissionArgs,
                payload.signature
            ],
            account: spender
        })
        console.log(approveHash);
        log += "Approve Hash: " + approveHash + ".";
        await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
        
        await new Promise(r => setTimeout(r, 10000));

        const spendHash = await client.writeContract({
            address: spendPermissionManagerAddress,
            abi: spendPermissionAbi,
            functionName: 'spend',
            args: [
                spendPermissionArgs,
                payload.allowance
            ],
            account: spender
        });
        console.log(spendHash);
        log += "Spend Hash: " + spendHash + ".";
        await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
        const memeCoins = await getLatestMemeCoins();
        const baseMemeCoins = memeCoins.filter((coin) => (coin.chainId === 'base'));
        if (baseMemeCoins.length > 0) {
            const selectedCoins = baseMemeCoins.slice(0, 4);
            const totalCoins = selectedCoins.length;
            const totalAllowance = parseInt(payload.allowance);
            let amountWei = parseInt((totalAllowance / totalCoins).toFixed(0));
            let remainingAllowance = totalAllowance;
            for (let index = 0; index < totalCoins; index++) {
                const toAsset = selectedCoins[index];
                if (index === totalCoins - 1) {
                    amountWei = remainingAllowance;
                } else {
                    remainingAllowance -= amountWei;
                }
                const trade = await spenderWallet.createTrade({
                    amount: amountWei,
                    fromAssetId: Coinbase.assets.Wei,
                    toAssetId: toAsset.tokenAddress,
                });
                log += `[${index + 1} of ${totalCoins}] Buying ${toAsset.tokenAddress} with ${amountWei} Wei: ` + trade.getTransaction().getTransactionHash() + ".";
                await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
                const completedTrade = await trade.wait();
                const toAmount = completedTrade.getToAmount();
                log += "Completed Trade: " + toAmount + ` ${toAsset.tokenAddress}` + " received.";
                await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
                const transfer = await spenderWallet.createTransfer({
                    amount: toAmount,
                    assetId: toAsset.tokenAddress,
                    destination: payload.account
                });
                log += `Transfering ${toAmount} ${toAsset.tokenAddress} to ${payload.account}: ` + transfer.getTransactionHash() + ".";
                await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
                await transfer.wait();
                log += "Completed Transfer: " + toAmount + ` ${toAsset.tokenAddress} to ${payload.account}.`;
                await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
            }
        }
        await updateBackgroundTaskStatus({ id: task.id, status: 'success', log });
        return true;
    } catch (error: any) {
        console.error(error);
        await updateBackgroundTaskStatus({ id: task.id, status: 'failed', log: log + error.toString() });
    }
}
