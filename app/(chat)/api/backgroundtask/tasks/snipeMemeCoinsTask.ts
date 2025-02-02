import 'server-only';
import { BackgroundTask } from "@/lib/db/schema";
import { getLatestMemeCoins } from "@/lib/integrations/dexscreener";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient } from 'viem'
import { base } from 'viem/chains'
import { http } from 'viem'
import { Payload, spendPermissionAbi } from "@/lib/utils";
import { updateBackgroundTaskStatus } from "@/lib/db/queries";

export async function snipeMemeCoinsTask(task: BackgroundTask) {
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
        const spendPermissionManagerAddress = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad';
        var log = "";

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
        log += "Approve Hash: " + approveHash + "\n";
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
        log += "Spend Hash: " + spendHash + "\n";
        await updateBackgroundTaskStatus({ id: task.id, status: 'running', log });
        const memeCoins = await getLatestMemeCoins();
        const baseMemeCoins = memeCoins.filter((coin) => (coin.chainId === 'base'));

        await updateBackgroundTaskStatus({ id: task.id, status: 'success', log });
        return true;
    } catch (error: any) {
        await updateBackgroundTaskStatus({ id: task.id, status: 'failed', log: error.toString() });
    }
}
