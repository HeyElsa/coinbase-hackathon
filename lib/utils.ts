import type {
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  Message,
  ToolInvocation,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Message as DBMessage, Document } from '@/lib/db/schema';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.',
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<Message>;
}): Array<Message> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId,
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: 'result',
              result: toolResult.result,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<DBMessage>,
): Array<Message> {
  return messages.reduce((chatMessages: Array<Message>, message) => {
    if (message.role === 'tool') {
      return addToolMessageToChat({
        toolMessage: message as CoreToolMessage,
        messages: chatMessages,
      });
    }

    let textContent = '';
    const toolInvocations: Array<ToolInvocation> = [];

    if (typeof message.content === 'string') {
      textContent = message.content;
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          textContent += content.text;
        } else if (content.type === 'tool-call') {
          toolInvocations.push({
            state: 'call',
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            args: content.args,
          });
        }
      }
    }

    chatMessages.push({
      id: message.id,
      role: message.role as Message['role'],
      content: textContent,
      toolInvocations,
    });

    return chatMessages;
  }, []);
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function sanitizeResponseMessages(
  messages: Array<ResponseMessage>,
): Array<ResponseMessage> {
  const toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of message.content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof message.content === 'string') return message;

    const sanitizedContent = message.content.filter((content) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true,
    );

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => message.content.length > 0,
  );
}

export function sanitizeUIMessages(messages: Array<Message>): Array<Message> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (!message.toolInvocations) return message;

    const toolResultIds: Array<string> = [];

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === 'result' ||
        toolResultIds.includes(toolInvocation.toolCallId),
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 ||
      (message.toolInvocations && message.toolInvocations.length > 0),
  );
}

export function getMostRecentUserMessage(messages: Array<Message>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export const truncateText = (text = "", count = 21): string => {
  if (text?.length <= count) {
    return text;
  } else {
    if (text.substring(0, 2) === "0x" && count > 5) {
      return `0x${truncateText(text.substring(2), count - 2)}`

    }
    const startCount = Math.ceil((count - 3) / 2);
    const endCount = Math.floor((count - 3) / 2);
    const start = text.substring(0, startCount);
    const end = text.substring(text.length - endCount);
    return `${start}...${end}`;
  }
};

export const spendPermissionAbi = JSON.parse('[{"inputs":[{"internalType":"contract PublicERC6492Validator","name":"publicERC6492Validator","type":"address"},{"internalType":"address","name":"magicSpend","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint48","name":"currentTimestamp","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"}],"name":"AfterSpendPermissionEnd","type":"error"},{"inputs":[{"internalType":"uint48","name":"currentTimestamp","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"}],"name":"BeforeSpendPermissionStart","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"ERC721TokenNotSupported","type":"error"},{"inputs":[],"name":"EmptySpendPermissionBatch","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"allowance","type":"uint256"}],"name":"ExceededSpendPermission","type":"error"},{"inputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"actualLastUpdatedPeriod","type":"tuple"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"expectedLastUpdatedPeriod","type":"tuple"}],"name":"InvalidLastUpdatedPeriod","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"expected","type":"address"}],"name":"InvalidSender","type":"error"},{"inputs":[],"name":"InvalidSignature","type":"error"},{"inputs":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"}],"name":"InvalidStartEnd","type":"error"},{"inputs":[{"internalType":"uint128","name":"noncePostfix","type":"uint128"},{"internalType":"uint128","name":"permissionHashPostfix","type":"uint128"}],"name":"InvalidWithdrawRequestNonce","type":"error"},{"inputs":[{"internalType":"address","name":"firstAccount","type":"address"},{"internalType":"address","name":"secondAccount","type":"address"}],"name":"MismatchedAccounts","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[{"internalType":"address","name":"spendToken","type":"address"},{"internalType":"address","name":"withdrawAsset","type":"address"}],"name":"SpendTokenWithdrawAssetMismatch","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"SpendValueOverflow","type":"error"},{"inputs":[{"internalType":"uint256","name":"spendValue","type":"uint256"},{"internalType":"uint256","name":"withdrawAmount","type":"uint256"}],"name":"SpendValueWithdrawAmountMismatch","type":"error"},{"inputs":[],"name":"UnauthorizedSpendPermission","type":"error"},{"inputs":[{"internalType":"uint256","name":"received","type":"uint256"},{"internalType":"uint256","name":"expected","type":"uint256"}],"name":"UnexpectedReceiveAmount","type":"error"},{"inputs":[],"name":"ZeroAllowance","type":"error"},{"inputs":[],"name":"ZeroPeriod","type":"error"},{"inputs":[],"name":"ZeroSpender","type":"error"},{"inputs":[],"name":"ZeroToken","type":"error"},{"inputs":[],"name":"ZeroValue","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"indexed":false,"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"SpendPermissionApproved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"indexed":false,"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"SpendPermissionRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"indexed":false,"internalType":"struct SpendPermissionManager.PeriodSpend","name":"periodSpend","type":"tuple"}],"name":"SpendPermissionUsed","type":"event"},{"inputs":[],"name":"MAGIC_SPEND","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"NATIVE_TOKEN","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PERMISSION_DETAILS_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PUBLIC_ERC6492_VALIDATOR","outputs":[{"internalType":"contract PublicERC6492Validator","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SPEND_PERMISSION_BATCH_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SPEND_PERMISSION_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"components":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.PermissionDetails[]","name":"permissions","type":"tuple[]"}],"internalType":"struct SpendPermissionManager.SpendPermissionBatch","name":"spendPermissionBatch","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"approveBatchWithSignature","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"permissionToApprove","type":"tuple"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"permissionToRevoke","type":"tuple"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"expectedLastUpdatedPeriod","type":"tuple"}],"name":"approveWithRevoke","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"approveWithSignature","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"eip712Domain","outputs":[{"internalType":"bytes1","name":"fields","type":"bytes1"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"version","type":"string"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"address","name":"verifyingContract","type":"address"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256[]","name":"extensions","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"components":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.PermissionDetails[]","name":"permissions","type":"tuple[]"}],"internalType":"struct SpendPermissionManager.SpendPermissionBatch","name":"spendPermissionBatch","type":"tuple"}],"name":"getBatchHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getCurrentPeriod","outputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getLastUpdatedPeriod","outputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isApproved","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isRevoked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isValid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"revoke","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"revokeAsSpender","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"uint160","name":"value","type":"uint160"}],"name":"spend","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"uint160","name":"value","type":"uint160"},{"components":[{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"expiry","type":"uint48"}],"internalType":"struct MagicSpend.WithdrawRequest","name":"withdrawRequest","type":"tuple"}],"name":"spendWithWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]');

export type Payload = {
  account: `0x${string}`;
  spender: `0x${string}`,
  token: `0x${string}`,
  allowance: string,
  period: number,
  start: number,
  end: number,
  salt: string,
  extraData: `0x${string}`,
  signature: `0x${string}`,
}
