/**
 * Inter-BRIC RPC Server
 * 
 * Receives requests from other BRICs with:
 * - mTLS authentication (Law #8)
 * - Request signature verification (Law #7)
 * - Request logging and rate limiting
 * - Error handling with proper HTTP status codes
 */

import https from "https";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import path from "path";

export interface RpcHandler {
  (request: RpcServerRequest): Promise<RpcServerResponse>;
}

export interface RpcServerRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  signature: string;
  clientCertificate?: any;
}

export interface RpcServerResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
  signature?: string;
}

export class RpcServer {
  private server: https.Server | null = null;
  private handlers: Map<string, RpcHandler> = new Map();
  private requestLog: any[] = [];
  private maxLogSize = 10000;

  constructor(
    private readonly name: string,
    private readonly port: number,
    private readonly certPath: string,
    private readonly keyPath: string,
    private readonly caCertPath: string
  ) {
    this.validateCertificates();
  }

  private validateCertificates(): void {
    const requiredPaths = [this.certPath, this.keyPath, this.caCertPath];

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
   * Register a request handler
   */
  register(
    method: string,
    path: string,
    handler: RpcHandler
  ): void {
    const key = `${method.toUpperCase()} ${path}`;
    this.handlers.set(key, handler);
    console.log(`RPC handler registered: ${key}`);
  }

  /**
   * Verify request signature (Law #7)
   */
  private verifySignature(
    method: string,
    path: string,
    body: any,
    timestamp: number,
    signature: string
  ): boolean {
    const payload = JSON.stringify({
      method,
      path,
      body,
      timestamp,
    });

    const expectedSignature = createHmac(
      "sha256",
      process.env.INTER_BRIC_SECRET || ""
    )
      .update(payload)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Sign response (Law #7)
   */
  private signResponse(body: any): string {
    const payload = JSON.stringify(body);

    return createHmac("sha256", process.env.INTER_BRIC_SECRET || "")
      .update(payload)
      .digest("hex");
  }

  /**
   * Log request for audit trail
   */
  private logRequest(
    method: string,
    path: string,
    clientCert: any,
    status: number,
    error?: string
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      clientCertificate: clientCert?.subject || "unknown",
      status,
      error,
      bricName: this.name,
    };

    this.requestLog.push(logEntry);

    // Keep log size under control
    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog = this.requestLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Start the RPC server
   */
  async start(): Promise<void> {
    const serverCert = readFileSync(path.resolve(this.certPath));
    const serverKey = readFileSync(path.resolve(this.keyPath));
    const caCert = readFileSync(path.resolve(this.caCertPath));

    const options = {
      cert: serverCert,
      key: serverKey,
      ca: caCert,
      // Require and verify client certificates (Law #8: Zero-Trust)
      requestCert: true,
      rejectUnauthorized: true,
    };

    this.server = https.createServer(options, async (req, res) => {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          // Extract certificate info from TLS connection
          const cert = (req.socket as any).getPeerCertificate?.();

          // Verify client certificate (Law #8)
          if (!cert || !cert.subject) {
            this.logRequest(
              req.method || "UNKNOWN",
              req.url || "",
              cert,
              401,
              "Client certificate validation failed"
            );

            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Client certificate validation failed",
              })
            );
            return;
          }

          // Parse request
          let parsedBody: any;
          try {
            parsedBody = body ? JSON.parse(body) : {};
          } catch {
            parsedBody = {};
          }

          // Extract RPC metadata from headers
          const timestamp = parseInt(
            req.headers["x-rpc-timestamp"] as string
          ) || 0;
          const signature = (req.headers["x-rpc-signature"] as string) || "";
          const sourceBric = (req.headers["x-rpc-source"] as string) || "unknown";

          // Verify signature (Law #7)
          if (
            !this.verifySignature(
              req.method || "GET",
              req.url || "",
              parsedBody,
              timestamp,
              signature
            )
          ) {
            this.logRequest(
              req.method || "UNKNOWN",
              req.url || "",
              cert,
              400,
              "Signature verification failed"
            );

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Signature verification failed. Possible tampering detected.",
              })
            );
            return;
          }

          // Find and execute handler
          const handlerKey = `${(req.method || "GET").toUpperCase()} ${req.url || ""}`;
          const handler = this.handlers.get(handlerKey);

          if (!handler) {
            this.logRequest(req.method || "GET", req.url || "", cert, 404);

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: `No handler found for ${handlerKey}`,
              })
            );
            return;
          }

          // Call handler
          const rpcRequest: RpcServerRequest = {
            method: req.method || "GET",
            path: req.url || "",
            headers: req.headers as Record<string, string>,
            body: parsedBody,
            timestamp,
            signature,
            clientCertificate: cert,
          };

          const handlerResponse = await handler(rpcRequest);

          // Sign response (Law #7)
          const responseSignature = this.signResponse(handlerResponse.body);
          const responseHeaders = {
            "Content-Type": "application/json",
            "X-RPC-Signature": responseSignature,
            "X-RPC-Timestamp": Date.now().toString(),
            ...handlerResponse.headers,
          };

          this.logRequest(
            req.method || "GET",
            req.url || "",
            cert,
            handlerResponse.status
          );

          res.writeHead(handlerResponse.status, responseHeaders);
          res.end(JSON.stringify(handlerResponse.body));
        } catch (error: any) {
          console.error("RPC server error:", error);

          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: error?.message || "Internal server error",
            })
          );
        }
      });
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(
          `Inter-BRIC RPC Server [${this.name}] listening on port ${this.port}`
        );
        console.log(
          "All connections require valid mTLS client certificates (Law #8)"
        );
        resolve();
      });
    });
  }

  /**
   * Stop the RPC server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`RPC Server [${this.name}] stopped`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get request audit log
   */
  getAuditLog(): any[] {
    return [...this.requestLog];
  }

  /**
   * Clear request audit log
   */
  clearAuditLog(): void {
    this.requestLog = [];
  }
}

export default RpcServer;
