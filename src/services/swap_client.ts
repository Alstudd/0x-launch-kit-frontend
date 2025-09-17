import { BigNumber } from '@0x/utils';

import { RELAYER_URL, FEE_PERCENTAGE, FEE_RECIPIENT } from '../common/constants';

export interface SwapQuote {
    to: string;
    data: string;
    value?: string;
    gas?: string;
    gasPrice?: string;
    buyAmount?: string;
    sellAmount?: string;
}

function swapBaseUrl(): string {
    // Convert http://host:3000/sra/v4 -> http://host:3000
    const idx = RELAYER_URL.indexOf('/sra/');
    return idx >= 0 ? RELAYER_URL.substring(0, idx) : RELAYER_URL;
}

export async function getSwapQuote(params: {
    side: 'Buy' | 'Sell';
    baseToken: string; // address
    quoteToken: string; // address
    amount: BigNumber; // base units
    takerAddress: string;
    slippagePercentage?: number; // 0.01 = 1%
}): Promise<SwapQuote> {
    const { side, baseToken, quoteToken, amount, takerAddress, slippagePercentage } = params;
    const url = new URL('/swap/v1/quote', swapBaseUrl());

    // Map to swap API params
    if (side === 'Buy') {
        url.searchParams.set('buyToken', baseToken);
        url.searchParams.set('buyAmount', amount.toString(10));
        url.searchParams.set('sellToken', quoteToken);
    } else {
        url.searchParams.set('sellToken', baseToken);
        url.searchParams.set('sellAmount', amount.toString(10));
        url.searchParams.set('buyToken', quoteToken);
    }
    url.searchParams.set('takerAddress', takerAddress);

    // Optional fees
    if (!FEE_PERCENTAGE.isZero() && FEE_RECIPIENT) {
        // For buys use buyTokenPercentageFee; for sells use sellTokenPercentageFee
        const pct = FEE_PERCENTAGE.toString(10);
        if (side === 'Buy') {
            url.searchParams.set('buyTokenPercentageFee', pct);
        } else {
            url.searchParams.set('sellTokenPercentageFee', pct);
        }
        url.searchParams.set('feeRecipient', FEE_RECIPIENT);
    }
    if (slippagePercentage !== undefined) {
        url.searchParams.set('slippagePercentage', slippagePercentage.toString());
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
}


