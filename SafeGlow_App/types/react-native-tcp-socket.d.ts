declare module 'react-native-tcp-socket' {
  export type TcpSocketOptions = {
    port: number;
    host: string;
    reuseAddress?: boolean;
  };

  export type TcpSocketClient = {
    write: (data: string | Uint8Array, encoding?: string) => void;
    destroy: () => void;
    on: (event: string, listener: (...args: any[]) => void) => void;
  };

  const TcpSocket: {
    createConnection: (options: TcpSocketOptions, callback?: () => void) => TcpSocketClient;
  };

  export default TcpSocket;
}
