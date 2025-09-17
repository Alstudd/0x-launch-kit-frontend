import { HttpClient, OrderConfigRequest, OrderConfigResponse, SignedOrder } from '@0x/connect';
import { assetDataUtils, AssetProxyId } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';
import { Orderbook } from '@0x/orderbook';
import { RateLimit } from 'async-sema';

import { RELAYER_RPS, RELAYER_URL, RELAYER_WS_URL } from '../common/constants';
import { tokenAmountInUnitsToBigNumber } from '../util/tokens';
import { Token } from '../util/types';

export class Relayer {
    private readonly _client: HttpClient;
    private readonly _rateLimit: () => Promise<void>;
    private readonly _orderbook: Orderbook;

    constructor(options: { rps: number }) {
        this._orderbook = Orderbook.getOrderbookForWebsocketProvider({
            httpEndpoint: RELAYER_URL,
            websocketEndpoint: RELAYER_WS_URL,
        });
        this._client = new HttpClient(RELAYER_URL);
        this._rateLimit = RateLimit(options.rps); // requests per second
    }

    public async getAllOrdersAsync(baseTokenAssetData: string, quoteTokenAssetData: string): Promise<SignedOrder[]> {
        // Fetch both orientations and merge to include both asks and bids
        const [sellOrders, buyOrders] = await Promise.all([
            this._getOrdersAsync(baseTokenAssetData, quoteTokenAssetData),
            this._getOrdersAsync(quoteTokenAssetData, baseTokenAssetData),
        ]);
        return [...sellOrders, ...buyOrders];
    }

    public async getOrderConfigAsync(orderConfig: OrderConfigRequest): Promise<OrderConfigResponse> {
        await this._rateLimit();
        return this._client.getOrderConfigAsync(orderConfig);
    }

    // V4 order_config request/response minimal types
    public async getOrderConfigV4Async(orderConfig: {
        maker: string;
        taker: string;
        makerToken: string;
        takerToken: string;
        makerAmount: string; // base units as string
        takerAmount: string; // base units as string
        verifyingContract: string; // exchangeProxy address
        expiry: string; // seconds since epoch
        chainId?: number;
    }): Promise<any> {
        await this._rateLimit();
        const res = await fetch(`${RELAYER_URL}/order_config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderConfig),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status} ${res.statusText}: ${text}`);
        }
        return res.json();
    }

    public async getUserOrdersAsync(
        account: string,
        baseTokenAssetData: string,
        quoteTokenAssetData: string,
    ): Promise<SignedOrder[]> {
        const [sellOrders, buyOrders] = await Promise.all([
            this._getOrdersAsync(baseTokenAssetData, quoteTokenAssetData, account),
            this._getOrdersAsync(quoteTokenAssetData, baseTokenAssetData, account),
        ]);

        return [...sellOrders, ...buyOrders];
    }

    public async getCurrencyPairPriceAsync(baseToken: Token, quoteToken: Token): Promise<BigNumber | null> {
        const asks = await this._getOrdersAsync(
            assetDataUtils.encodeERC20AssetData(baseToken.address),
            assetDataUtils.encodeERC20AssetData(quoteToken.address),
        );

        if (asks.length) {
            const lowestPriceAsk = asks[0];

            const { makerAssetAmount, takerAssetAmount } = lowestPriceAsk;
            const takerAssetAmountInUnits = tokenAmountInUnitsToBigNumber(takerAssetAmount, quoteToken.decimals);
            const makerAssetAmountInUnits = tokenAmountInUnitsToBigNumber(makerAssetAmount, baseToken.decimals);
            return takerAssetAmountInUnits.div(makerAssetAmountInUnits);
        }

        return null;
    }

    public async getSellCollectibleOrdersAsync(
        collectibleAddress: string,
        wethAddress: string,
    ): Promise<SignedOrder[]> {
        await this._rateLimit();
        const result = await this._client.getOrdersAsync({
            makerAssetProxyId: AssetProxyId.ERC721,
            takerAssetProxyId: AssetProxyId.ERC20,
            makerAssetAddress: collectibleAddress,
            takerAssetAddress: wethAddress,
        });

        return result.records.map(record => record.order);
    }

    public async submitOrderAsync(order: SignedOrder): Promise<void> {
        await this._rateLimit();
        return this._client.submitOrderAsync(order);
    }

    private async _getOrdersAsync(
        makerAssetData: string,
        takerAssetData: string,
        makerAddress?: string,
    ): Promise<SignedOrder[]> {
        // Decode assetData to get underlying token addresses
        let makerTokenAddress: string | undefined;
        let takerTokenAddress: string | undefined;
        try {
            const makerDecoded: any = assetDataUtils.decodeAssetDataOrThrow(makerAssetData);
            const takerDecoded: any = assetDataUtils.decodeAssetDataOrThrow(takerAssetData);
            makerTokenAddress = makerDecoded.tokenAddress || makerDecoded.tokenAddresses?.[0];
            takerTokenAddress = takerDecoded.tokenAddress || takerDecoded.tokenAddresses?.[0];
        } catch (_e) {
            // Fallback: return empty if cannot decode
            return [];
        }

        if (!makerTokenAddress || !takerTokenAddress) {
            return [];
        }

        // Query SRA v4 HTTP orderbook directly to support v4
        const url = `${RELAYER_URL}/orderbook?baseToken=${makerTokenAddress}&quoteToken=${takerTokenAddress}`;
        const res = await fetch(url);
        if (!res.ok) {
            return [];
        }
        const data = await res.json();

        // Choose side based on which asset is passed as maker in this call.
        // When makerAssetData === baseToken, relevant side is asks; when makerAssetData === quoteToken, relevant side is bids.
        const preferredRecords =
            data && data.asks && Array.isArray(data.asks.records) && data.asks.records.length > 0
                ? data.asks.records
                : data && data.bids && Array.isArray(data.bids.records)
                ? data.bids.records
                : [];

        let records = preferredRecords;

        // Fallback: if orderbook is empty, use /orders and filter client-side (some setups don't expose orderbook correctly)
        if (records.length === 0) {
            try {
                const allRes = await fetch(`${RELAYER_URL}/orders`);
                if (allRes.ok) {
                    const allData = await allRes.json();
                    const rawRecords: any[] = (allData && allData.records) || [];
                    records = rawRecords
                        .filter((rec: any) => {
                            const o = rec.order || rec;
                            const mk = (o.makerToken || '').toLowerCase();
                            const tk = (o.takerToken || '').toLowerCase();
                            return mk === makerTokenAddress!.toLowerCase() && tk === takerTokenAddress!.toLowerCase();
                        })
                        .map((rec: any) => rec.order || rec);
                }
            } catch (_e) {
                // ignore
            }
        }

        const orders: SignedOrder[] = records.map((r: any) => {
            const v4 = r.order || r;
            // Map v4 fields to v2 SignedOrder shape expected by UI helpers
            const maker = v4.maker || v4.makerAddress;
            const taker = v4.taker || v4.takerAddress || '0x0000000000000000000000000000000000000000';
            const sender = v4.sender || v4.senderAddress || '0x0000000000000000000000000000000000000000';
            const feeRecipient = v4.feeRecipient || v4.feeRecipientAddress || '0x0000000000000000000000000000000000000000';
            const makerToken = v4.makerToken || v4.makerAsset || makerTokenAddress;
            const takerToken = v4.takerToken || v4.takerAsset || takerTokenAddress;
            const chainId = v4.chainId || undefined;
            const makerAmount = new BigNumber(v4.makerAmount || '0');
            const takerAmount = new BigNumber(v4.takerAmount || '0');
            const expiration = new BigNumber(v4.expiry || v4.expirationTimeSeconds || '0');
            const salt = new BigNumber(v4.salt || '0');

            return {
                makerAddress: maker,
                takerAddress: taker,
                senderAddress: sender,
                feeRecipientAddress: feeRecipient,
                expirationTimeSeconds: expiration,
                salt,
                makerAssetAmount: makerAmount,
                takerAssetAmount: takerAmount,
                makerAssetData: assetDataUtils.encodeERC20AssetData(makerToken),
                takerAssetData: assetDataUtils.encodeERC20AssetData(takerToken),
                makerFee: new BigNumber(0),
                takerFee: new BigNumber(0),
                makerFeeAssetData: '0x',
                takerFeeAssetData: '0x',
                chainId,
                signature: typeof v4.signature === 'string' ? v4.signature : '',
            } as any as SignedOrder;
        });

        if (makerAddress) {
            return orders.filter((o: any) => o.makerAddress === makerAddress || o.maker === makerAddress);
        }
        return orders;
    }
}

let relayer: Relayer;
export const getRelayer = (): Relayer => {
    if (!relayer) {
        relayer = new Relayer({ rps: RELAYER_RPS });
    }

    return relayer;
};
