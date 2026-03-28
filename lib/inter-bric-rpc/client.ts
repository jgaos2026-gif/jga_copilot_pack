/**
 * Inter-BRIC RPC Client
 * 
 * Secure service-to-service communication with:
 * - mTLS (mutual TLS certificate validation)
 * - Request signing and verification (Law #7)
 * - Circuit breaker pattern
 * - Automatic retry with exponential backoff
 * - Service discovery
 * 
 * Law #8: Zero-Trust Architecture requires all inter-BRIC communication to use
 * certificate-based authentication and encryption.
 */

import https from "https";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import pRetry from "p-retry";

export interface RpcServiceConfig {
  name: string;
  host: string;
  port: number;
  certPath: string;
  keyPath: string;
  caPath: string; // Root CA certificate
  timeout: number; // ms
}

export interface RpcRequest {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

export interface RpcResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  signature: string; // HMAC signature from Stitch BRIC
}

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private readonly threshold = 5,
    private readonly resetTimeout = 60000 // 1 minute
  ) {}

  async execute<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "half-open";
        this.failureCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is open. Service unavailable. Retry after ${this.resetTimeout}ms`
        );
      }
    }

    try {
      const result = await fn();
      if (this.state === "half-open") {
        this.state = "closed";
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.threshold) {
        this.state = "open";
      }

      throw error;
    }
  }

  getState() {
    return this.state;
  }
}

/**
 * Inter-BRIC RPC Client
 * 
 * Handles all BRIC-to-BRIC communication with certificate validation
 */
export class InterBricRpcClient {
  private config: RpcServiceConfig;
  private circuitBreaker: CircuitBreaker;
  private lastSequenceNumber = 0;

  constructor(config: RpcServiceConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(5, 60000);

    // Validate certificate files exist
    this.validateCertificates();
  }

  private validateCertificates(): void {
    const requiredPaths = [
      this.config.certPath,
      this.config.keyPath,
      this.config.caPath,
    ];

    for (const certPath of requiredPaths) {
      try {
        readFileSync(path.resolve(certPath));
      } catch (error) {
        throw new Error(
          `Certificate file not found: ${certPath}. Law #8 requires valid mTLS certificates.`
        );
      }
    }
  }

  /**
   * Sign request with HMAC (Law #7)
   * 
   * All inter-BRIC requests are signed to ensure integrity
   */
  private signRequest(
    method: string,
    path: string,
    body: any,
    timestamp: number
  ): string {
    const payload = JSON.stringify({
      method,
      path,
      body,
      timestamp,
    });

    // Sign with shared secret (would be rotated per BRIC pair)
    const signature = createHmac("sha256", process.env.INTER_BRIC_SECRET || "")
      .update(payload)
      .digest("hex");

    return signature;
  }

  /**
   * Verify response signature
   */
  private verifySignature(
    payload: string,
    signature: string
  ): boolean {
    const expectedSignature = createHmac(
      "sha256",
      process.env.INTER_BRIC_SECRET || ""
    )
      .update(payload)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Make request to another BRIC with automatic retry
   */
  async request<T = any>(rpcRequest: RpcRequest): Promise<RpcResponse> {
    return this.circuitBreaker.execute(() =>
      pRetry(
        () => this.makeHttpsRequest<T>(rpcRequest),
        {
          retries: 3,
          minTimeout: 100,
          maxTimeout: 3000,
          onFailedAttempt: (error) => {
            console.warn(
              `Inter-BRIC RPC request failed. Attempt ${error.attemptNumber}`,
              error.message
            );
          },
        }
      )
    );
  }

  private makeHttpsRequest<T = any>(
    rpcRequest: RpcRequest
  ): Promise<RpcResponse> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const signature = this.signRequest(
        rpcRequest.method,
        rpcRequest.path,
        rpcRequest.body,
        timestamp
      );

      // Load client certificates (Law #8: mTLS)
      const clientCert = readFileSync(path.resolve(this.config.certPath));
      const clientKey = readFileSync(path.resolve(this.config.keyPath));
      const caCert = readFileSync(path.resolve(this.config.caPath));

      const httpsAgent = new https.Agent({
        cert: clientCert,
        key: clientKey,
        ca: caCert,
        rejectUnauthorized: true, // Enforce certificate validation (Law #8)
      });

      const options = {
        hostname: this.config.host,
        port: this.config.port,
        path: rpcRequest.path,
        method: rpcRequest.method,
        agent: httpsAgent,
        timeout: this.config.timeout,
        headers: {
          "Content-Type": "application/json",
          "X-RPC-Timestamp": timestamp.toString(),
          "X-RPC-Signature": signature,
          "X-RPC-Source": process.env.BRIC_NAME || "unknown",
          "X-RPC-Version": "1.0",
          ...rpcRequest.headers,
        },
      };

      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsedData = JSON.parse(data);

            // Verify response signature
            const responseSignature = res.headers["x-rpc-signature"] as string;
            if (
              responseSignature &&
              !this.verifySignature(data, responseSignature)
            ) {
              return reject(
                new Error(
                  "Response signature verification failed. Possible tampering detected."
                )
              );
            }

            const response: RpcResponse = {
              status: res.statusCode || 500,
              headers: res.headers as Record<string, string>,
              body: parsedData,
              timestamp: Date.now(),
              signature: responseSignature || "",
            };

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`RPC request failed: ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse RPC response: ${error}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`RPC request error: ${error.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`RPC request timeout after ${this.config.timeout}ms`));
      });

      // Send request body
      if (rpcRequest.body) {
        req.write(JSON.stringify(rpcRequest.body));
      }

      req.end();
    });
  }
}

/**
 * Service Registry for BRIC Discovery
 * 
 * Maps BRIC names to their network endpoints
 */
export class ServiceRegistry {
  private services: Map<string, RpcServiceConfig> = new Map();

  register(config: RpcServiceConfig): void {
    this.services.set(config.name, config);
  }

  get(name: string): RpcServiceConfig {
    const config = this.services.get(name);
    if (!config) {
      throw new Error(`Service not found: ${name}`);
    }
    return config;
  }

  getAllServices(): string[] {
    return Array.from(this.services.keys());
  }

  static fromEnvironment(): ServiceRegistry {
    const registry = new ServiceRegistry();

    // Register services from environment variables
    const services = [
      { name: "spine", port: 4001 },
      { name: "system-b", port: 4002 },
      { name: "state-ca", port: 4003 },
      { name: "state-il", port: 4004 },
      { name: "state-tx", port: 4005 },
      { name: "owners-room", port: 4006 },
      { name: "overseer", port: 4007 },
      { name: "stitch", port: 4008 },
    ];

    for (const service of services) {
      const host = process.env[`BRIC_${service.name.toUpperCase()}_HOST`] || "localhost";
      const port = parseInt(process.env[`BRIC_${service.name.toUpperCase()}_PORT`] || service.port.toString());
      const certPath = process.env[`BRIC_${service.name.toUpperCase()}_CERT`] ||
        `/etc/jga/brics/${service.name}/cert.pem`;
      const keyPath = process.env[`BRIC_${service.name.toUpperCase()}_KEY`] ||
        `/etc/jga/brics/${service.name}/key.pem`;
      const caPath = process.env.JGA_BRIC_CA_PATH || "/etc/jga/ca-cert.pem";

      registry.register({
        name: service.name,
        host,
        port,
        certPath,
        keyPath,
        caPath,
        timeout: 5000,
      });
    }

    return registry;
  }
}

/**
 * RPC Client Factory
 * 
 * Creates and caches RPC clients for all BRICs
 */
export class RpcClientFactory {
  private clients: Map<string, InterBricRpcClient> = new Map();
  private registry: ServiceRegistry;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  getClient(serviceName: string): InterBricRpcClient {
    if (!this.clients.has(serviceName)) {
      const config = this.registry.get(serviceName);
      this.clients.set(serviceName, new InterBricRpcClient(config));
    }

    return this.clients.get(serviceName)!;
  }

  getAllClients(): InterBricRpcClient[] {
    const services = this.registry.getAllServices();
    return services.map((name) => this.getClient(name));
  }
}

export default InterBricRpcClient;
