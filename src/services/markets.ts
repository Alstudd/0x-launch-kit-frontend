import { BigNumber } from '@0x/utils';
import { apiRateLimiter } from './api_rate_limiter';

const ETH_MARKET_PRICE_API_ENDPOINT = 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT';

export const getMarketPriceEther = async (): Promise<BigNumber> => {
    const cacheKey = 'eth_price';

    const cachedPrice = apiRateLimiter.getCachedData<BigNumber>('binance', cacheKey);
    if (cachedPrice) {
        return cachedPrice;
    }

    if (!apiRateLimiter.canMakeRequest('binance')) {
        const staleData = apiRateLimiter.getCachedData<BigNumber>('binance', cacheKey);
        if (staleData) {
            console.warn('Using stale ETH price due to rate limiting');
            return staleData;
        }

        console.warn('Rate limited and no cached data, using fallback ETH price');
        const fallbackPriceUSD = 2000;
        return new BigNumber(fallbackPriceUSD);
    }
    
    try {
        const response = await fetch(ETH_MARKET_PRICE_API_ENDPOINT);
        
        if (!response.ok) {
            throw new Error(`Binance API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.price) {
            const price = new BigNumber(data.price);

            apiRateLimiter.cacheData('binance', cacheKey, price);
            
            return price;
        } else {
            throw new Error('Invalid response format from Binance API');
        }
    } catch (error) {
        console.warn('Failed to fetch ETH price from Binance API, using fallback:', error);

        const staleData = apiRateLimiter.getCachedData<BigNumber>('binance', cacheKey);
        if (staleData) {
            console.warn('Using cached ETH price due to API failure');
            return staleData;
        }
        
        const fallbackPriceUSD = 2000;
        return new BigNumber(fallbackPriceUSD);
    }
};
