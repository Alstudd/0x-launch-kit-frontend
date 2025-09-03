export const API_CONFIG = {
    POLLING: {
        STORE_UPDATE_INTERVAL: process.env.REACT_APP_STORE_UPDATE_INTERVAL 
            ? parseInt(process.env.REACT_APP_STORE_UPDATE_INTERVAL) 
            : 30000,

        ETH_PRICE_UPDATE_INTERVAL: process.env.REACT_APP_ETH_PRICE_UPDATE_INTERVAL 
            ? parseInt(process.env.REACT_APP_ETH_PRICE_UPDATE_INTERVAL) 
            : 300000,
    },

    RATE_LIMITS: {
        BINANCE: {
            maxRequests: 10,
            timeWindowMs: 60000,
            cacheDurationMs: 300000
        },
        INFURA: {
            maxRequests: 5,
            timeWindowMs: 60000,
            cacheDurationMs: 120000
        },
        DEFAULT: {
            maxRequests: 20,
            timeWindowMs: 60000,
            cacheDurationMs: 300000
        }
    },

    FALLBACKS: {
        ETH_PRICE_USD: 2000,
        GAS_PRICE_GWEI: 6,
        ESTIMATED_TRANSACTION_TIME_MS: 120000
    },

    ENVIRONMENT: process.env.NODE_ENV || 'development',

    DEBUG: process.env.REACT_APP_DEBUG === 'true' || process.env.NODE_ENV === 'development'
};

export const UI_UPDATE_CHECK_INTERVAL = API_CONFIG.POLLING.STORE_UPDATE_INTERVAL;
export const UPDATE_ETHER_PRICE_INTERVAL = API_CONFIG.POLLING.ETH_PRICE_UPDATE_INTERVAL;
