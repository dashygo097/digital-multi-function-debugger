import React, { useState, useEffect, useCallback } from "react";

interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

const getWebSerialPorts = async (): Promise<SerialPortInfo[]> => {
  if ("serial" in navigator) {
    try {
      const ports = await (navigator as any).serial.getPorts();
      return ports.map((port: any, index: number) => ({
        path: `Web Serial Port ${index + 1}`,
        manufacturer: "Unknown",
        serialNumber: "N/A",
        pnpId: "Web Serial API",
        locationId: "N/A",
        productId: "N/A",
        vendorId: "N/A",
      }));
    } catch (error) {
      console.error("Web Serial API error:", error);
      return [];
    }
  }
  return [];
};

const SerialPortsList: React.FC = () => {
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [useWebSerial, setUseWebSerial] = useState<boolean>(false);

  const listSerialPorts = useCallback(async () => {
    try {
      setIsLoading(true);

      let portList: SerialPortInfo[] = [];

      if (useWebSerial) {
        portList = await getWebSerialPorts();
        if (portList.length === 0) {
          setError(
            'No Web Serial ports found. Click "Request Port Access" to connect a device.',
          );
        } else {
          setError("");
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation
        portList = [];

        if (portList.length === 0) {
          setError("No ports discovered");
        } else {
          setError("");
        }
      }

      setPorts(portList);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setPorts([]);
    } finally {
      setIsLoading(false);
    }
  }, [useWebSerial]);

  const requestWebSerialAccess = async () => {
    if ("serial" in navigator) {
      try {
        await (navigator as any).serial.requestPort();
        setUseWebSerial(true);
        listSerialPorts();
      } catch (error) {
        setError(
          "Failed to access Web Serial API. User may have cancelled the request.",
        );
      }
    } else {
      setError("Web Serial API is not supported in this browser.");
    }
  };

  useEffect(() => {
    listSerialPorts();

    const intervalId = setInterval(() => {
      listSerialPorts();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [listSerialPorts]);

  const renderPortsTable = () => {
    if (ports.length === 0) return null;

    const headers = [
      "Path",
      "Manufacturer",
      "Serial Number",
      "PnP ID",
      "Location ID",
      "Product ID",
      "Vendor ID",
    ];

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {headers.map((header) => (
                <th
                  key={header}
                  className="border border-gray-300 px-4 py-2 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ports.map((port, index) => (
              <tr key={`${port.path}-${index}`} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">
                  {port.path}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.manufacturer || "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.serialNumber || "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.pnpId || "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.locationId || "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.productId || "-"}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {port.vendorId || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Serial Ports</h1>

      {isLoading && (
        <div className="flex items-center mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-gray-600">Loading serial ports...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={listSerialPorts}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh Now"}
        </button>

        <button
          onClick={() => setUseWebSerial(!useWebSerial)}
          className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          {useWebSerial ? "Use Mock Data" : "Use Web Serial API"}
        </button>

        {!useWebSerial && (
          <button
            onClick={requestWebSerialAccess}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Request Port Access
          </button>
        )}
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          {useWebSerial
            ? "Using Web Serial API (Chrome/Edge only). Click 'Request Port Access' to connect to real devices."
            : "Using mock data for demonstration. Toggle to Web Serial API to connect to real devices."}
        </p>
      </div>

      {!isLoading && !error && (
        <div className="mb-4 text-sm text-gray-600">
          Found {ports.length} serial port{ports.length !== 1 ? "s" : ""}
          <span className="ml-2 text-xs">(Auto-refreshes every 2 seconds)</span>
        </div>
      )}

      <div id="ports">{renderPortsTable()}</div>
    </div>
  );
};

export default SerialPortsList;
