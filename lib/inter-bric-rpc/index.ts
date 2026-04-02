/**
 * Inter-BRIC RPC Layer
 * Service-to-service communication with mTLS
 * Implements Law #8: Zero-Trust Communication
 */

import https from 'https';
import fs from 'fs';

export interface RpcRequest {
  method: string;
  service: string;
  params: Record<string, any>;
  requestId: string;
  timestamp: string;
  correlationId?: string;
}

export interface RpcResponse {
  success: boolean;
  result?: any;
  error?: string;
  requestId: string;
  timestamp: string;
  correlationId?: string;
}

/**
 * Policy-based access control for inter-BRIC calls
 * Implements default-deny (Law #8)
 */
const rpcPolicies: Record<string, string[]> = {
  // Public BRIC can call System B
  'public-bric': ['system-b'],

  // System B can call State BRIC and Spine
  'system-b': ['state-bric', 'spine'],

  // State BRIC can call Spine and Stitch
  'state-bric': ['spine', 'stitch', 'compliance'],

  // Spine can call Compliance
  'spine': ['compliance', 'stitch'],

  // Compliance (Overseer) can call Stitch
  'compliance': ['stitch'],

  // Stitch is trusted by all (for verification)
  'stitch': ['state-bric', 'audit-log'],

  // Owners Room can call State BRIC and Compliance
  'owners-room': ['state-bric', 'compliance', 'stitch'],
};

/**
 * mTLS configuration for inter-BRIC cert setup
 */
export interface mTLSConfig {
  serviceName: string;
  certPath: string;
  keyPath: string;
  caPath: string;
}

/**
 * RPC Client for calling other BRICs
 */
export class RpcClient {
  private config: mTLSConfig;
  private callLog: RpcRequest[] = [];

  constructor(config: mTLSConfig) {
    this.config = config;
  }

  /**
   * Call another BRIC service
   * Returns error if policy denies call (Law #8)
   */
  async call(
    targetService: string,
    method: string,
    params: Record<string, any>,
    correlationId?: string
  ): Promise<RpcResponse> {
    // Policy check: default DENY
    const allowedTargets = rpcPolicies[this.config.serviceName];
    if (!allowedTargets || !allowedTargets.includes(targetService)) {
      const error = `Call denied by Law #8 (Zero-Trust): ${this.config.serviceName} -> ${targetService}`;
      console.error(error);
      return {
        success: false,
        error,
        requestId: `req_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }

    const request: RpcRequest = {
      method,
      service: targetService,
      params,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    this.callLog.push(request);

    try {
      // mTLS handshake: client cert + CA verification
      const httpAgent = new https.Agent({
        cert: fs.readFileSync(this.config.certPath),
        key: fs.readFileSync(this.config.keyPath),
        ca: fs.readFileSync(this.config.caPath),
        rejectUnauthorized: true, // Enforce cert verification
      });

      // Construct internal service URL (service discovery)
      const url = new URL(`https://${targetService}:8443/rpc`);

      // Make mTLS request
      return new Promise((resolve, reject) => {
        const reqBody = JSON.stringify(request);

        const httpsReq = https.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(reqBody),
              'X-Request-ID': request.requestId,
              'X-Correlation-ID': correlationId || request.requestId,
            },
            agent: httpAgent,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const response = JSON.parse(data) as RpcResponse;
                resolve(response);
              } catch (e) {
                reject(new Error(`Invalid RPC response: ${data}`));
              }
            });
          }
        );

        httpsReq.on('error', reject);
        httpsReq.write(reqBody);
        httpsReq.end();
      });
    } catch (error) {
      console.error(`RPC call failed: ${this.config.serviceName} -> ${targetService}`, error);
      return {
        success: false,
        error: String(error),
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get call audit log
   */
  getCallLog(): RpcRequest[] {
    return [...this.callLog];
  }
}

/**
 * RPC Server for receiving calls from other BRICs
 */
export class RpcServer {
  private handlers: Map<string, (params: any) => Promise<any>> = new Map();

  constructor(_config: mTLSConfig) {}

  /**
   * Register RPC method handler
   */
  registerHandler(method: string, handler: (params: any) => Promise<any>): void {
    this.handlers.set(method, handler);
  }

  /**
   * Process incoming RPC request
   */
  async handleRequest(request: RpcRequest): Promise<RpcResponse> {
    try {
      const handler = this.handlers.get(request.method);

      if (!handler) {
        return {
          success: false,
          error: `Unknown method: ${request.method}`,
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        };
      }

      const result = await handler(request.params);

      return {
        success: true,
        result,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`RPC handler error for ${request.method}:`, error);
      return {
        success: false,
        error: String(error),
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
