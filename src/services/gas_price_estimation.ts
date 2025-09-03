import { BigNumber } from '@0x/utils';

import { DEFAULT_ESTIMATED_TRANSACTION_TIME_MS, DEFAULT_GAS_PRICE, GWEI_IN_WEI } from '../common/constants';
import { getLogger } from '../util/logger';
import { GasInfo } from '../util/types';
import { apiRateLimiter } from './api_rate_limiter';

interface InfuraGasResult {
    low: {
        suggestedMaxPriorityFeePerGas: string;
        suggestedMaxFeePerGas: string;
        estimatedBaseFee: string;
        blockNum: number;
        estimatedSeconds: number;
    };
    medium: {
        suggestedMaxPriorityFeePerGas: string;
        suggestedMaxFeePerGas: string;
        estimatedBaseFee: string;
        blockNum: number;
        estimatedSeconds: number;
    };
    high: {
        suggestedMaxPriorityFeePerGas: string;
        suggestedMaxFeePerGas: string;
        estimatedBaseFee: string;
        blockNum: number;
        estimatedSeconds: number;
    };
    estimatedBaseFee: string;
    blockTime: number;
    blockNum: number;
}

const logger = getLogger('gas_price_estimation');

const INFURA_GAS_API_BASE_URL = 'https://gas.api.infura.io/v3';
const INFURA_API_KEY = process.env.REACT_APP_INFURA_API_KEY || '';

export const getGasEstimationInfoAsync = async (): Promise<GasInfo> => {
    const cacheKey = 'gas_info';

    const cachedGasInfo = apiRateLimiter.getCachedData<GasInfo>('infura', cacheKey);
    if (cachedGasInfo) {
        return cachedGasInfo;
    }

    if (!apiRateLimiter.canMakeRequest('infura')) {
        const staleData = apiRateLimiter.getCachedData<GasInfo>('infura', cacheKey);
        if (staleData) {
            logger.warn('Using stale gas info due to rate limiting');
            return staleData;
        }

        logger.warn('Rate limited and no cached data, using fallback gas info');
        return {
            gasPriceInWei: DEFAULT_GAS_PRICE,
            estimatedTimeMs: DEFAULT_ESTIMATED_TRANSACTION_TIME_MS,
        };
    }
    
    let fetchedAmount: GasInfo | undefined;

    try {
        fetchedAmount = await fetchFastAmountInWeiAsync();

        apiRateLimiter.cacheData('infura', cacheKey, fetchedAmount);
    } catch (e) {
        logger.warn('Failed to fetch gas price from Infura, using fallback:', e);

        const staleData = apiRateLimiter.getCachedData<GasInfo>('infura', cacheKey);
        if (staleData) {
            logger.warn('Using cached gas info due to API failure');
            return staleData;
        }
        
        fetchedAmount = undefined;
    }

    const info = fetchedAmount || {
        gasPriceInWei: DEFAULT_GAS_PRICE,
        estimatedTimeMs: DEFAULT_ESTIMATED_TRANSACTION_TIME_MS,
    };
    logger.info(info);
    return info;
};

const fetchFastAmountInWeiAsync = async (): Promise<GasInfo> => {
    if (!INFURA_API_KEY || INFURA_API_KEY === 'YOUR_INFURA_API_KEY') {
        throw new Error('Infura API key not configured. Please set REACT_APP_INFURA_API_KEY environment variable.');
    }

    const url = `${INFURA_GAS_API_BASE_URL}/${INFURA_API_KEY}/networks/1/suggestedGasFees`;
    const res = await fetch(url);
    
    if (!res.ok) {
        throw new Error(`Infura gas API request failed: ${res.status} ${res.statusText}`);
    }
    
    const gasInfo = (await res.json()) as InfuraGasResult;
    
    const suggestedMaxFeePerGas = new BigNumber(gasInfo.medium.suggestedMaxFeePerGas);
    const estimatedSeconds = gasInfo.medium.estimatedSeconds;
    
    const estimatedTimeMs = estimatedSeconds * 1000;
    
    return { 
        gasPriceInWei: suggestedMaxFeePerGas, 
        estimatedTimeMs 
    };
};
