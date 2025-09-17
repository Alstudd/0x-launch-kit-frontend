import {
    DecodedLogEvent,
    ExchangeContract,
    ExchangeEvents,
    ExchangeFillEventArgs,
    LogWithDecodedArgs,
    IZeroExContract,
    IZeroExLimitOrderFilledEventArgs,
    IZeroExRfqOrderFilledEventArgs,
    IZeroExEvents,
} from '@0x/contract-wrappers';

interface SubscribeToFillEventsParams {
    exchange: IZeroExContract;
    fromBlock: number;
    toBlock: number;
    ethAccount: string;
    fillEventCallback: (log: LogWithDecodedArgs<IZeroExLimitOrderFilledEventArgs | IZeroExRfqOrderFilledEventArgs>) => any;
    pastFillEventsCallback: (log: Array<LogWithDecodedArgs<IZeroExLimitOrderFilledEventArgs | IZeroExRfqOrderFilledEventArgs>>) => any;
}

export const subscribeToFillEvents = ({
    exchange,
    fromBlock,
    toBlock,
    ethAccount,
    fillEventCallback,
    pastFillEventsCallback,
}: SubscribeToFillEventsParams): string => {
    // Subscribe to LimitOrderFilled events
    const limitOrderSubscription = exchange.subscribe(
        IZeroExEvents.LimitOrderFilled,
        { maker: ethAccount },
        (err: Error | null, logEvent?: DecodedLogEvent<IZeroExLimitOrderFilledEventArgs>) => {
            if (err || !logEvent) {
                console.error('There was a problem with the LimitOrderFilled event', err, logEvent);
                return;
            }
            fillEventCallback(logEvent.log);
        },
    );

    // Subscribe to RfqOrderFilled events
    const rfqOrderSubscription = exchange.subscribe(
        IZeroExEvents.RfqOrderFilled,
        { maker: ethAccount },
        (err: Error | null, logEvent?: DecodedLogEvent<IZeroExRfqOrderFilledEventArgs>) => {
            if (err || !logEvent) {
                console.error('There was a problem with the RfqOrderFilled event', err, logEvent);
                return;
            }
            fillEventCallback(logEvent.log);
        },
    );

    // Get past LimitOrderFilled events
    exchange
        .getLogsAsync<IZeroExLimitOrderFilledEventArgs>(
            IZeroExEvents.LimitOrderFilled,
            {
                fromBlock,
                toBlock,
            },
            {
                maker: ethAccount,
            },
        )
        .then(limitOrderLogs => {
            // Get past RfqOrderFilled events
            exchange
                .getLogsAsync<IZeroExRfqOrderFilledEventArgs>(
                    IZeroExEvents.RfqOrderFilled,
                    {
                        fromBlock,
                        toBlock,
                    },
                    {
                        maker: ethAccount,
                    },
                )
                .then(rfqOrderLogs => {
                    // Combine both event types
                    const allLogs = [...limitOrderLogs, ...rfqOrderLogs];
                    pastFillEventsCallback(allLogs);
                });
        });

    // Return a combined subscription ID (we'll need to handle cleanup differently)
    return `limit_${limitOrderSubscription}_rfq_${rfqOrderSubscription}`;
};
