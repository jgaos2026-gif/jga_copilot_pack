/**
 * BRIC Contract Types
 * Type definitions shared across all BRIC modules
 */

/**
 * US state codes supported by the JGA platform
 */
export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC';

/**
 * BRIC identity descriptor
 */
export interface BricDescriptor {
  id: string;
  type: 'public' | 'system-b' | 'state' | 'spine' | 'owners-room' | 'compliance' | 'stitch';
  stateCode?: StateCode;
  version: string;
}

/**
 * BRIC health status
 */
export interface BricHealth {
  bricId: string;
  status: 'healthy' | 'degraded' | 'offline';
  complianceGateOpen: boolean;
  lastChecked: string;
}

/**
 * Inter-BRIC message envelope (Law #8 - Zero-Trust Communication)
 */
export interface BricMessage {
  fromBric: string;
  toBric: string;
  traceId: string;
  timestamp: number;
  payload: unknown;
}
