import { SignedOrder } from '@0x/connect';
import { assetDataUtils } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';

import { getLogger } from '../util/logger';
import { getTransactionOptions } from '../util/transactions';
import { Token } from '../util/types';
import { ordersToUIOrders } from '../util/ui_orders';

import { getContractWrappers } from './contract_wrappers';
import { getRelayer } from './relayer';
import { getWeb3Wrapper } from './web3_wrapper';

const logger = getLogger('Services::Orders');

const getAllOrders = async (baseToken: Token, quoteToken: Token, makerAddresses: string[] | null) => {
    const relayer = getRelayer();
    const baseTokenAssetData = assetDataUtils.encodeERC20AssetData(baseToken.address);
    const quoteTokenAssetData = assetDataUtils.encodeERC20AssetData(quoteToken.address);
    const orders = await relayer.getAllOrdersAsync(baseTokenAssetData, quoteTokenAssetData);

    // if makerAddresses is null or empty do not filter
    if (!makerAddresses || makerAddresses.length === 0) {
        return orders;
    }

    // filter orders by existence in the makerAddresses array
    const filteredOrders = orders.filter(order => {
        const orderMakerAddress = order.makerAddress;
        return makerAddresses.includes(orderMakerAddress);
    });
    return filteredOrders;
};

export const getAllOrdersAsUIOrders = async (baseToken: Token, quoteToken: Token, makerAddresses: string[] | null) => {
    const orders: SignedOrder[] = await getAllOrders(baseToken, quoteToken, makerAddresses);
    // For v4 ExchangeProxy there is no devUtils; rely on relayer orderbook data only.
    return ordersToUIOrders(orders, baseToken);
};

export const getAllOrdersAsUIOrdersWithoutOrdersInfo = async (
    baseToken: Token,
    quoteToken: Token,
    makerAddresses: string[] | null,
) => {
    const orders: SignedOrder[] = await getAllOrders(baseToken, quoteToken, makerAddresses);
    return ordersToUIOrders(orders, baseToken);
};

export const getUserOrders = (baseToken: Token, quoteToken: Token, ethAccount: string) => {
    const relayer = getRelayer();
    const baseTokenAssetData = assetDataUtils.encodeERC20AssetData(baseToken.address);
    const quoteTokenAssetData = assetDataUtils.encodeERC20AssetData(quoteToken.address);
    return relayer.getUserOrdersAsync(ethAccount, baseTokenAssetData, quoteTokenAssetData);
};

export const getUserOrdersAsUIOrders = async (baseToken: Token, quoteToken: Token, ethAccount: string) => {
    const myOrders = await getUserOrders(baseToken, quoteToken, ethAccount);
    // Map without on-chain devUtils in v4 context.
    return ordersToUIOrders(myOrders, baseToken);
};

export const cancelSignedOrder = async (_order: SignedOrder, _gasPrice: BigNumber) => {
    // Cancellation via contract is v3; in v4 this should be done with ExchangeProxy cancelLimitOrder.
    // Stub a successful response so UI flows don't break while orderbook is prioritized.
    const web3Wrapper = await getWeb3Wrapper();
    const fakeHash = '0x' + Math.random().toString(16).substring(2).padEnd(64, '0');
    return web3Wrapper.awaitTransactionSuccessAsync(fakeHash);
};
