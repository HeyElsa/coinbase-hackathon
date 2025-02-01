import { useAccount, useChainId, useConnect, useSignTypedData } from "wagmi";
import { Button } from "../ui/button";
import { IconCoinbase } from "../icons";
import { parseUnits } from "viem";
import { useLocalStorage } from "usehooks-ts";
import { toast } from "sonner";

type Props = {
    budget: number
    requestId: string
}
export function SnipeMemeCoins({ budget, requestId }: Props) {
    const [ signature, setSignature ] = useLocalStorage<`0x${string}` | null>('sign:' + requestId, null);
    const account = useAccount();
    const { connect, connectors } = useConnect();
    const chainId = useChainId();
    const { signTypedData } = useSignTypedData();
    const cbswConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');
    function approveSpending() {
        if (!account.address) {
            throw Error("Wallet is not connected properly!");
        }
        const spender = process.env.NEXT_PUBLIC_SPENDER_ADDRESS as `0x${string}`;
        const token = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
        const spendPermissionManagerAddress = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad';
        const allowance = parseUnits(budget.toString(), 18);
        const nowTimestamp = Math.floor(Date.now() / 1000);
        const period = 86400;
        const payloadObj = {
            budget: budget.toString(),
            address: account.address,
        };
        const payload = JSON.stringify(payloadObj);
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
                allowance,
                period: period,
                start: nowTimestamp,
                end: nowTimestamp + period,
                salt: BigInt(nowTimestamp),
                extraData: '0x',
            },
        }, {
            onSuccess: async (data) => {
                setSignature(data);
                const result = await fetch('/api/backgroundtask', {
                  method: 'POST',
                  body: JSON.stringify({
                    type: 'snipeMemeCoins',
                    payload,
                  }),
                });
                if (!result.ok) {
                    console.error(result);
                    toast.error('Failed to add background task');
                } else {
                    toast.success('Task successfully registered!');
                }
            }
        });
    }
    if (signature) {
        return (
            <span>
                {signature}
            </span>
        );
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
