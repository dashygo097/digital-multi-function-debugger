export interface Message {
  timestamp: string;
  direction: "TX" | "RX" | "INFO" | "ERROR";
  data: string;
  id: string;
  source?: string;
  payloadHex?: string;
}
