import {
  createContext,
  useReducer,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { FFT } from "@utils";
import { AnalogSignalData } from "@components";
import { useUDPContext } from "./UDPContext";
import { useSerialContext } from "./SerialContext";

const MAX_SAMPLES_ANALOG = 2048;
const MAX_SAMPLES_DIGITAL = 256;
const FFT_SIZE = 128;

interface AnalogState {
  channelData: AnalogSignalData[][];
  spectrumData: number[];
  activeChannels: boolean[];
  isRunning: boolean;
  showSpectrum: boolean;
  processedMessageIds: Set<string>;
  sampleRate: number;
}

interface DigitalState {
  byteData: number[];
  isRunning: boolean;
  processedMessageIds: Set<string>;
}

interface AnalyzerState {
  analyzerType: "analog" | "digital";
  dataSource: "serial" | "udp";
  analog: AnalogState;
  digital: DigitalState;
}

// All possible actions that can be dispatched to the reducer
type Action =
  | { type: "SET_ANALYZER_TYPE"; payload: "analog" | "digital" }
  | { type: "SET_DATA_SOURCE"; payload: "serial" | "udp" }
  | { type: "START_ANALOG_CAPTURE"; payload: Set<string> }
  | { type: "STOP_ANALOG_CAPTURE" }
  | {
      type: "ADD_ANALOG_SAMPLES";
      payload: { samples: number[]; messageId: string };
    }
  | { type: "CLEAR_ANALOG_DATA"; payload: Set<string> }
  | { type: "TOGGLE_SPECTRUM" }
  | { type: "START_DIGITAL_CAPTURE"; payload: Set<string> }
  | { type: "STOP_DIGITAL_CAPTURE" }
  | {
      type: "ADD_DIGITAL_BYTES";
      payload: { bytes: number[]; messageId: string };
    }
  | { type: "CLEAR_DIGITAL_DATA"; payload: Set<string> };

// The shape of the context value provided to consumers
export interface AnalyzerContextType extends AnalyzerState {
  setAnalyzerType: (type: "analog" | "digital") => void;
  setDataSource: (source: "serial" | "udp") => void;
  toggleAnalogCapture: () => void;
  clearAnalogData: (currentMessageIds: Set<string>) => void;
  toggleSpectrum: () => void;
  toggleDigitalCapture: () => void;
  clearDigitalData: (currentMessageIds: Set<string>) => void;
}

// --- INITIAL STATE & FFT INSTANCE ---

const initialState: AnalyzerState = {
  analyzerType: "analog",
  dataSource: "udp",
  analog: {
    channelData: [[]],
    spectrumData: [],
    activeChannels: [true],
    isRunning: false,
    showSpectrum: false,
    processedMessageIds: new Set(),
    sampleRate: 44100,
  },
  digital: {
    byteData: [],
    isRunning: false,
    processedMessageIds: new Set(),
  },
};

const fft = new FFT(FFT_SIZE);

const reducer = (state: AnalyzerState, action: Action): AnalyzerState => {
  switch (action.type) {
    case "SET_ANALYZER_TYPE":
      return { ...state, analyzerType: action.payload };
    case "SET_DATA_SOURCE":
      return { ...state, dataSource: action.payload };

    case "START_ANALOG_CAPTURE":
      return {
        ...state,
        analog: {
          ...state.analog,
          isRunning: true,
          processedMessageIds: action.payload,
        },
      };
    case "STOP_ANALOG_CAPTURE":
      return { ...state, analog: { ...state.analog, isRunning: false } };

    case "ADD_ANALOG_SAMPLES": {
      const { samples, messageId } = action.payload;
      const combinedData = [...state.analog.channelData[0], ...samples];
      const truncatedData = combinedData.slice(-MAX_SAMPLES_ANALOG);
      const newSpectrumData = state.analog.showSpectrum
        ? fft.calculate(truncatedData.slice(-FFT_SIZE))
        : state.analog.spectrumData;
      const newProcessedIds = new Set(state.analog.processedMessageIds).add(
        messageId,
      );
      return {
        ...state,
        analog: {
          ...state.analog,
          channelData: [truncatedData],
          spectrumData: newSpectrumData,
          processedMessageIds: newProcessedIds,
        },
      };
    }

    case "CLEAR_ANALOG_DATA":
      return {
        ...state,
        analog: {
          ...state.analog,
          channelData: [[]],
          spectrumData: [],
          processedMessageIds: action.payload,
        },
      };

    case "TOGGLE_SPECTRUM": {
      const willShow = !state.analog.showSpectrum;
      let newSpectrumData: number[] = [];

      if (willShow && state.analog.channelData[0].length >= FFT_SIZE) {
        const signalSlice = state.analog.channelData[0].slice(-FFT_SIZE);
        newSpectrumData = fft.calculate(signalSlice);
      }

      return {
        ...state,
        analog: {
          ...state.analog,
          showSpectrum: willShow,
          spectrumData: newSpectrumData,
        },
      };
    }

    case "START_DIGITAL_CAPTURE":
      return {
        ...state,
        digital: {
          ...state.digital,
          isRunning: true,
          processedMessageIds: action.payload,
        },
      };
    case "STOP_DIGITAL_CAPTURE":
      return { ...state, digital: { ...state.digital, isRunning: false } };

    case "ADD_DIGITAL_BYTES": {
      const { bytes, messageId } = action.payload;
      const newProcessedIds = new Set(state.digital.processedMessageIds).add(
        messageId,
      );
      return {
        ...state,
        digital: {
          ...state.digital,
          byteData: [...state.digital.byteData, ...bytes].slice(
            -MAX_SAMPLES_DIGITAL,
          ),
          processedMessageIds: newProcessedIds,
        },
      };
    }

    case "CLEAR_DIGITAL_DATA":
      return {
        ...state,
        digital: {
          ...state.digital,
          byteData: [],
          processedMessageIds: action.payload,
        },
      };

    default:
      return state;
  }
};

export const AnalyzerContext = createContext<AnalyzerContextType | undefined>(
  undefined,
);

export const AnalyzerProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { udpTerminal } = useUDPContext();
  const { serialTerminal } = useSerialContext();

  const addAnalogSamples = (samples: number[], messageId: string) =>
    dispatch({ type: "ADD_ANALOG_SAMPLES", payload: { samples, messageId } });
  const addDigitalBytes = (bytes: number[], messageId: string) =>
    dispatch({ type: "ADD_DIGITAL_BYTES", payload: { bytes, messageId } });
  const toggleAnalogCapture = () => {
    if (!state.analog.isRunning) {
      const currentMessageIds = new Set<string>(
        udpTerminal.messages.map((m) => m.id).filter(Boolean) as string[],
      );
      dispatch({ type: "START_ANALOG_CAPTURE", payload: currentMessageIds });
    } else {
      dispatch({ type: "STOP_ANALOG_CAPTURE" });
    }
  };
  const toggleDigitalCapture = () => {
    if (!state.digital.isRunning) {
      const messages = state.dataSource === "udp" ? udpTerminal.messages : []; // Or serialTerminal.messages
      const currentMessageIds = new Set<string>(
        messages.map((m) => m.id).filter(Boolean) as string[],
      );
      dispatch({ type: "START_DIGITAL_CAPTURE", payload: currentMessageIds });
    } else {
      dispatch({ type: "STOP_DIGITAL_CAPTURE" });
    }
  };

  useEffect(() => {
    if (
      state.analyzerType !== "analog" ||
      !state.analog.isRunning ||
      state.dataSource !== "udp"
    )
      return;

    for (const msg of udpTerminal.messages) {
      if (!msg?.id || state.analog.processedMessageIds.has(msg.id)) continue;

      if (msg.direction === "RX" && msg.payloadHex) {
        const samples =
          msg.payloadHex
            .replace(/[\s,]/g, "")
            .match(/.{1,2}/g)
            ?.map((hp) => parseInt(hp, 16))
            .filter((n) => !isNaN(n) && n >= 0 && n <= 255) || [];
        if (samples.length > 0) {
          addAnalogSamples(samples, msg.id);
        }
      }
    }
  }, [
    state.analyzerType,
    state.analog.isRunning,
    state.dataSource,
    udpTerminal.messages,
    state.analog.processedMessageIds,
  ]);

  useEffect(() => {
    if (state.analyzerType !== "digital" || !state.digital.isRunning) return;

    const messages =
      state.dataSource === "udp"
        ? udpTerminal.messages
        : state.dataSource === "serial"
          ? serialTerminal.messages
          : [];
    for (const msg of messages) {
      if (!msg?.id || state.digital.processedMessageIds.has(msg.id)) continue;

      if (msg.direction === "RX" && msg.payloadHex) {
        const bytes = msg.payloadHex
          .split(/\s+/)
          .map((hp) => parseInt(hp, 16))
          .filter((n) => !isNaN(n));
        if (bytes.length > 0) {
          addDigitalBytes(bytes, msg.id);
        }
      }
    }
  }, [
    state.analyzerType,
    state.digital.isRunning,
    state.dataSource,
    udpTerminal.messages,
    state.digital.processedMessageIds,
  ]);

  const value: AnalyzerContextType = {
    ...state,
    setAnalyzerType: (type) =>
      dispatch({ type: "SET_ANALYZER_TYPE", payload: type }),
    setDataSource: (source) =>
      dispatch({ type: "SET_DATA_SOURCE", payload: source }),
    toggleAnalogCapture,
    clearAnalogData: (ids) =>
      dispatch({ type: "CLEAR_ANALOG_DATA", payload: ids }),
    toggleSpectrum: () => dispatch({ type: "TOGGLE_SPECTRUM" }),
    toggleDigitalCapture,
    clearDigitalData: (ids) =>
      dispatch({ type: "CLEAR_DIGITAL_DATA", payload: ids }),
  };

  return (
    <AnalyzerContext.Provider value={value}>
      {children}
    </AnalyzerContext.Provider>
  );
};

export const useAnalyzer = (): AnalyzerContextType => {
  const context = useContext(AnalyzerContext);
  if (context === undefined) {
    throw new Error("useAnalyzer must be used within an AnalyzerProvider");
  }
  return context;
};
