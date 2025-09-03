/// <reference types="react-scripts" />

declare module 'json-rpc-error';

declare module 'react' {
    interface ReactNode {
        [key: string]: any;
    }
}

declare module 'react-redux' {
    interface ProviderProps {
        children?: React.ReactNode;
    }
}

declare module 'react-router' {
    interface RouteComponentProps {
        [key: string]: any;
    }
}

declare module 'connected-react-router' {
    interface ConnectedRouterProps {
        children?: React.ReactNode;
    }
}

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: any;
    }
}

declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveBeenCalledWith(...args: any[]): R;
            toEqual(value: any): R;
        }
    }
}

declare module 'redux-mock-store' {
    export default function configureStore(middlewares?: any[]): any;
}
