import { assetDataUtils } from '@0x/order-utils';
import { BigNumber } from '@0x/utils';

import { Token, TokenBalance } from '../util/types';

import { getWeb3Wrapper } from './web3_wrapper';

export const tokensToTokenBalances = async (tokens: Token[], address: string): Promise<TokenBalance[]> => {
    const web3Wrapper = await getWeb3Wrapper();
    
    const tokenBalances: TokenBalance[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
        try {
            const token = tokens[i];
            
            const balance = await web3Wrapper.getBalanceInWeiAsync(address);
            
            const isUnlocked = true;
            
            tokenBalances.push({
                token,
                balance,
                isUnlocked,
            });
        } catch (tokenError) {
            console.error(`Error getting balance for token ${tokens[i].symbol}:`, tokenError);
            tokenBalances.push({
                token: tokens[i],
                balance: new BigNumber(0),
                isUnlocked: false,
            });
        }
    }
    
    return tokenBalances;
};
export const tokenToTokenBalance = async (token: Token, address: string): Promise<TokenBalance> => {
    try {
        const [tokenBalance] = await tokensToTokenBalances([token], address);
        return tokenBalance;
    } catch (error) {
        console.error('Error in tokenToTokenBalance:', error);
        return {
            token,
            balance: new BigNumber(0),
            isUnlocked: false,
        };
    }
};

export const getTokenBalance = async (token: Token, address: string): Promise<BigNumber> => {
    const balance = await tokenToTokenBalance(token, address);
    return balance.balance;
};
