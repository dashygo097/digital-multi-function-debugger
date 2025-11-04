import React, { ReactNode, createContext, useContext } from "react";
import { ProtocolContext } from "./ProtocolContext";
import { AnalogSignalData, DigitalByteData } from "@components";
import { Message, FFT } from "@utils";

const MAX_ANALOG_SAMPLES = 2048;
const MAX_DIGITAL_SAMPLES = 256;
const FFT_SIZE = 128;
const ANALOG_CHANNEL_COUNT = 3;

// --- STATE AND TYPE DEFINITIONS (Unchanged) ---
interface AnalogState {
  channelData: AnalogSignalData[][];
  spectrumData: number[];
  activeChannels: boolean[];
  isRunning: boolean;
  showSpectrum: boolean;
  sampleRate: number;
}
interface DigitalState {
  byteData: DigitalByteData[];
  isRunning: boolean;
}
interface AnalyzerState {
  analyzerType: "analog" | "digital";
  dataSource: "serial" | "udp";
  analog: AnalogState;
  digital: DigitalState;
  processedMessageIds: Set<string>;
}
export interface AnalyzerContextType {
  state: AnalyzerState;
  setAnalyzerType: (type: "analog" | "digital") => void;
  setDataSource: (source: "serial" | "udp") => void;
  startCapture: (type: "analog" | "digital") => void;
  stopCapture: (type: "analog" | "digital") => void;
  clearData: () => void;
  toggleAnalogChannel: (channelIdx: number) => void;
  toggleSpectrum: () => void;
  setSampleRate: (rate: number) => void;
}

export const AnalyzerContext = createContext<AnalyzerContextType | null>(null);

// --- PROVIDER IMPLEMENTATION (with Persistence) ---
export class AnalyzerProvider extends React.Component<{ children: ReactNode }> {
  static contextType = ProtocolContext;
  context!: React.ContextType<typeof ProtocolContext>;

  private fft: FFT;
  private readonly logRegex = /TEMP=([\d.-]+).*V=([\d.-]+).*I=([\d.-]+)/;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.fft = new FFT(FFT_SIZE);

    // Load saved settings from localStorage
    const savedState = this.loadFromStorage("analyzerState");

    this.state = {
      analyzerType: savedState?.analyzerType || "analog",
      dataSource: savedState?.dataSource || "udp",
      analog: {
        channelData: Array(ANALOG_CHANNEL_COUNT)
          .fill(null)
          .map(() => []),
        spectrumData: [],
        activeChannels: Array(ANALOG_CHANNEL_COUNT).fill(true),
        isRunning: false,
        showSpectrum: false,
        sampleRate: 44100,
      },
      digital: {
        byteData: [],
        isRunning: false,
      },
      processedMessageIds: new Set<string>(),
    };
  }

  // --- STORAGE METHODS ---
  private loadFromStorage = (key: string): Partial<AnalyzerState> | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn("Failed to load analyzer state from storage", error);
      return null;
    }
  };

  private saveToStorage = (key: string, data: Partial<AnalyzerState>) => {
    try {
      const stateToSave = {
        analyzerType: data.analyzerType,
        dataSource: data.dataSource,
      };
      localStorage.setItem(key, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn("Failed to save analyzer state to storage", error);
    }
  };

  // --- LIFECYCLE AND DATA PROCESSING (Unchanged) ---
  componentDidUpdate() {
    const { analog, digital } = this.state;
    if (analog.isRunning || digital.isRunning) {
      this.processContextMessages();
    }
  }

  private processContextMessages = () => {
    const { analyzerType, dataSource, processedMessageIds } = this.state;
    const terminal =
      dataSource === "udp"
        ? this.context?.udpTerminal
        : this.context?.serialTerminal;
    if (!terminal?.messages) return;

    for (const m of terminal.messages) {
      if (!m?.id || processedMessageIds.has(m.id)) continue;

      this.setState((prev) => ({
        processedMessageIds: new Set(prev.processedMessageIds).add(m.id!),
      }));
      if (m.direction !== "RX") continue;

      if (analyzerType === "analog" && this.state.analog.isRunning)
        this.parseAnalogData(m);
      else if (
        analyzerType === "digital" &&
        this.state.digital.isRunning &&
        m.payloadHex
      )
        this.parseDigitalData(m.payloadHex);
    }
  };

  private parseAnalogData = (message: Message) => {
    const match = message.data.match(this.logRegex);
    if (!match) return;
    const [temp, voltage, current] = [
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
    ];
    if ([temp, voltage, current].some(isNaN)) return;

    this.setState((prev: AnalyzerState) => {
      const newChannelData = prev.analog.channelData.map((c) => [...c]);
      newChannelData[0] = [...newChannelData[0], temp].slice(
        -MAX_ANALOG_SAMPLES,
      );
      newChannelData[1] = [...newChannelData[1], voltage].slice(
        -MAX_ANALOG_SAMPLES,
      );
      newChannelData[2] = [...newChannelData[2], current].slice(
        -MAX_ANALOG_SAMPLES,
      );
      const newSpectrumData = prev.analog.showSpectrum
        ? this.getSpectrum(newChannelData[0])
        : prev.analog.spectrumData;
      return {
        analog: {
          ...prev.analog,
          channelData: newChannelData,
          spectrumData: newSpectrumData,
        },
      };
    });
  };

  private parseDigitalData = (hexString: string) => {
    if (!hexString?.trim()) return;
    const bytes = hexString
      .split(/\s+/)
      .map((hp) => parseInt(hp, 16))
      .filter((n) => !isNaN(n));
    if (bytes.length === 0) return;
    this.setState((prev: AnalyzerState) => ({
      digital: {
        ...prev.digital,
        byteData: [...prev.digital.byteData, ...bytes].slice(
          -MAX_DIGITAL_SAMPLES,
        ),
      },
    }));
  };

  private getSpectrum = (data: number[]): number[] => {
    if (data.length < FFT_SIZE) return [];
    return this.fft.calculate(data.slice(-FFT_SIZE));
  };

  // --- ACTIONS (Updated to save state) ---
  private updateStateAndSave = (updates: Partial<AnalyzerState>) => {
    this.setState(updates, () => {
      this.saveToStorage("analyzerState", this.state);
    });
  };

  setAnalyzerType = (type: "analog" | "digital") => {
    const updates: Partial<AnalyzerState> = { analyzerType: type };
    if (type === "analog") updates.dataSource = "udp";
    this.updateStateAndSave(updates);
  };

  setDataSource = (source: "serial" | "udp") => {
    this.updateStateAndSave({ dataSource: source });
  };

  // (The rest of the actions do not need to save state, so they remain unchanged)
  startCapture = (type: "analog" | "digital") => {
    const terminal =
      this.state.dataSource === "udp"
        ? this.context?.udpTerminal
        : this.context?.serialTerminal;
    const currentMessageIds = new Set<string>(
      terminal?.messages.map((msg) => msg.id).filter(Boolean) || [],
    );
    const updates = { processedMessageIds: currentMessageIds };
    if (type === "analog")
      this.setState({
        analog: { ...this.state.analog, isRunning: true },
        ...updates,
      });
    else
      this.setState({
        digital: { ...this.state.digital, isRunning: true },
        ...updates,
      });
  };
  stopCapture = (type: "analog" | "digital") => {
    if (type === "analog")
      this.setState((prev) => ({
        analog: { ...prev.analog, isRunning: false },
      }));
    else
      this.setState((prev) => ({
        digital: { ...prev.digital, isRunning: false },
      }));
  };
  clearData = () => {
    const terminal =
      this.state.dataSource === "udp"
        ? this.context?.udpTerminal
        : this.context?.serialTerminal;
    const currentMessageIds = new Set<string>(
      terminal?.messages.map((msg) => msg.id).filter(Boolean) || [],
    );
    if (this.state.analyzerType === "analog") {
      this.setState({
        analog: {
          ...this.state.analog,
          channelData: Array(ANALOG_CHANNEL_COUNT).fill([]),
          spectrumData: [],
        },
        processedMessageIds: currentMessageIds,
      });
    } else {
      this.setState({
        digital: { ...this.state.digital, byteData: [] },
        processedMessageIds: currentMessageIds,
      });
    }
  };
  toggleAnalogChannel = (channelIdx: number) => {
    this.setState((prev) => {
      const newActive = [...prev.analog.activeChannels];
      newActive[channelIdx] = !newActive[channelIdx];
      return { analog: { ...prev.analog, activeChannels: newActive } };
    });
  };
  toggleSpectrum = () => {
    this.setState((prev: AnalyzerState) => {
      const willShow = !prev.analog.showSpectrum;
      const spectrumData = willShow
        ? this.getSpectrum(prev.analog.channelData[0])
        : [];
      return {
        analog: { ...prev.analog, showSpectrum: willShow, spectrumData },
      };
    });
  };
  setSampleRate = (rate: number) => {
    if (rate > 0)
      this.setState((prev) => ({
        analog: { ...prev.analog, sampleRate: rate },
      }));
  };

  render() {
    const contextValue: AnalyzerContextType = {
      state: this.state,
      setAnalyzerType: this.setAnalyzerType,
      setDataSource: this.setDataSource,
      startCapture: this.startCapture,
      stopCapture: this.stopCapture,
      clearData: this.clearData,
      toggleAnalogChannel: this.toggleAnalogChannel,
      toggleSpectrum: this.toggleSpectrum,
      setSampleRate: this.setSampleRate,
    };
    return (
      <AnalyzerContext.Provider value={contextValue}>
        {this.props.children}
      </AnalyzerContext.Provider>
    );
  }
}

export const useAnalyzerContext = () => {
  const context = useContext(AnalyzerContext);
  if (!context)
    throw new Error(
      "useAnalyzerContext must be used within an AnalyzerProvider",
    );
  return context;
};
