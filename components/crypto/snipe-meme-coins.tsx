import { useAccount, useChainId, useConnect, useSignTypedData } from "wagmi";
import { Button } from "../ui/button";
import { IconCoinbase } from "../icons";
import { parseUnits } from "viem";
import { useDebounceCallback, useInterval, useLocalStorage } from "usehooks-ts";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher, Payload } from "@/lib/utils";
import { BackgroundTask } from "@/lib/db/schema";
import { useEffect, useState } from "react";

type Props = {
    budget: number
    requestId: string
}
export function SnipeMemeCoins({ budget, requestId }: Props) {
    const [signature, setSignature] = useLocalStorage<`0x${string}` | null>('sign:' + requestId, null);
    const account = useAccount();
    const { connect, connectors } = useConnect();
    useDebounceCallback
    const chainId = useChainId();
    const { signTypedData } = useSignTypedData();
    const cbswConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');
    const [pollInterval, setPollInterval] = useState<number | null>(null);

    const {
        data: fetchedTask,
        mutate: mutateFetchedTask,
    } = useSWR<BackgroundTask>(
        signature
            ? `/api/backgroundtask?id=${requestId}`
            : null,
        fetcher,
    );

    useEffect(() => {
        mutateFetchedTask();
    }, [signature, mutateFetchedTask]);

    useInterval(mutateFetchedTask, pollInterval);

    useEffect(() => {
        if (signature && (
            !fetchedTask ||
            ['pending', 'running'].includes(fetchedTask.status)
        )) {
            setPollInterval(10000);
        } else {
            setPollInterval(null);
        }
    }, [signature, fetchedTask])

    function approveSpending() {
        if (!account.address) {
            throw Error("Wallet is not connected properly!");
        }
        const spender = process.env.NEXT_PUBLIC_SPENDER_ADDRESS as `0x${string}`;
        const token = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const spendPermissionManagerAddress = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad';
        const allowance = parseUnits(budget.toString(), 18).toString();
        const nowTimestamp = Math.floor(Date.now() / 1000);
        const period = 86400;
        const start = nowTimestamp;
        const end = nowTimestamp + period;
        const salt = nowTimestamp.toString();
        const extraData = '0x';
        signTypedData({
            domain: {
                name: "Spend Permission Manager",
                version: "1",
                chainId: chainId,
                verifyingContract: spendPermissionManagerAddress,
            },
            types: {
                SpendPermission: [
                    { name: 'account', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'token', type: 'address' },
                    { name: 'allowance', type: 'uint160' },
                    { name: 'period', type: 'uint48' },
                    { name: 'start', type: 'uint48' },
                    { name: 'end', type: 'uint48' },
                    { name: 'salt', type: 'uint256' },
                    { name: 'extraData', type: 'bytes' },
                ],
            },
            primaryType: 'SpendPermission',
            message: {
                account: account.address,
                spender,
                token,
                allowance: BigInt(allowance),
                period,
                start,
                end,
                salt: BigInt(salt),
                extraData,
            },
        }, {
            onSuccess: async (data) => {
                const payloadObj: Payload = {
                    account: account.address as `0x${string}`,
                    spender,
                    token,
                    allowance,
                    period,
                    start,
                    end,
                    salt,
                    extraData,
                    signature: data,
                };
                const payload = JSON.stringify(payloadObj);
                const result = await fetch('/api/backgroundtask', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: requestId,
                        type: 'snipeMemeCoins',
                        payload,
                    }),
                });
                if (!result.ok) {
                    console.error(result);
                    toast.error('Failed to add background task');
                } else {
                    toast.success('Task successfully registered!');
                    setSignature(data);
                }
            }
        });
    }
    if (fetchedTask) {
        return (
            <div>
                <span>
                    {
                        (fetchedTask.status === 'pending' && 'Task is yet to be processed. Please wait for a few seconds.') ||
                        (fetchedTask.status === 'running' && 'Task is under processing...') ||
                        (fetchedTask.status === 'success' && '✅ Task finished successfully.') ||
                        (fetchedTask.status === 'success' && '❌ Task failed.')
                    }
                </span>
                <br />
                {fetchedTask.log?.trim().split('\n').map((logEntry, index) => (
                    <span key={fetchedTask.id + "-" + index}>
                        {logEntry}.<br />
                    </span>
                ))}
            </div>
        )
    } else if (signature) {
        return (
            <span>Fetching task status...</span>
        )
    }
    if (account.status == 'connected') {
        return (
            <div>
                <div>
                    <span>
                        Initiating background action to snipe meme coins with {budget}
                    </span>
                </div>
                <Button variant="default" onClick={approveSpending}>Approve spending</Button>
            </div>
        );
    }
    if (!!cbswConnector) {
        return (
            <div>
                <div>
                    <span>Please connect your Coinbase Smart Wallet to proceed...</span>
                </div>
                <Button variant="default" onClick={() => connect({ connector: cbswConnector })}>
                    <IconCoinbase />
                    Connect
                </Button>
            </div>
        )
    } else {
        return (
            <span>Unable to find the coinbase smart wallet connector!</span>
        );
    }
}
