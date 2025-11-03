export class FFT {
  private size: number;
  private reverseTable: Uint32Array;
  private sinTable: Float32Array;
  private cosTable: Float32Array;

  constructor(size: number) {
    if (size & (size - 1)) {
      throw new Error("FFT size must be a power of 2.");
    }
    this.size = size;
    this.reverseTable = new Uint32Array(size);
    this.sinTable = new Float32Array(size);
    this.cosTable = new Float32Array(size);

    this.precomputeTables();
  }

  private precomputeTables() {
    let limit = 1;
    let bit = this.size >> 1;
    while (limit < this.size) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit = limit << 1;
      bit = bit >> 1;
    }

    for (let i = 0; i < this.size; i++) {
      this.sinTable[i] = Math.sin(-Math.PI / i);
      this.cosTable[i] = Math.cos(-Math.PI / i);
    }
  }

  private applyWindow(signal: number[]): number[] {
    const N = signal.length;
    const windowed = new Array(N);
    for (let i = 0; i < N; i++) {
      // Hann window
      windowed[i] =
        signal[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    return windowed;
  }

  public calculate(signal: number[]): number[] {
    if (signal.length !== this.size) {
      throw new Error(`Signal length must be ${this.size}.`);
    }

    const windowedSignal = this.applyWindow(signal);

    const buffer = new Float32Array(this.size * 2);
    for (let i = 0; i < this.size; i++) {
      buffer[2 * i] = windowedSignal[i];
      buffer[2 * i + 1] = 0;
    }

    this.transform(buffer);

    const magnitudes = new Array(this.size / 2);
    for (let i = 0; i < this.size / 2; i++) {
      const real = buffer[2 * i];
      const imag = buffer[2 * i + 1];
      magnitudes[i] = Math.sqrt(real * real + imag * imag) / this.size;
    }

    return magnitudes;
  }

  private transform(buffer: Float32Array) {
    const size = this.size;

    // Bit-reversal
    for (let i = 0; i < size; i++) {
      const j = this.reverseTable[i];
      if (j > i) {
        const tempReal = buffer[2 * i];
        const tempImag = buffer[2 * i + 1];
        buffer[2 * i] = buffer[2 * j];
        buffer[2 * i + 1] = buffer[2 * j + 1];
        buffer[2 * j] = tempReal;
        buffer[2 * j + 1] = tempImag;
      }
    }

    // Cooley-Tukey FFT
    for (let halfSize = 1; halfSize < size; halfSize *= 2) {
      const phaseShiftStepReal = this.cosTable[halfSize * 2];
      const phaseShiftStepImag = this.sinTable[halfSize * 2];

      let currentPhaseShiftReal = 1.0;
      let currentPhaseShiftImag = 0.0;

      for (let fftStep = 0; fftStep < halfSize; fftStep++) {
        for (let i = fftStep; i < size; i += halfSize * 2) {
          const off = i + halfSize;
          const tr =
            currentPhaseShiftReal * buffer[off * 2] -
            currentPhaseShiftImag * buffer[off * 2 + 1];
          const ti =
            currentPhaseShiftReal * buffer[off * 2 + 1] +
            currentPhaseShiftImag * buffer[off * 2];

          buffer[off * 2] = buffer[i * 2] - tr;
          buffer[off * 2 + 1] = buffer[i * 2 + 1] - ti;
          buffer[i * 2] += tr;
          buffer[i * 2 + 1] += ti;
        }

        const nextPhaseShiftReal =
          currentPhaseShiftReal * phaseShiftStepReal -
          currentPhaseShiftImag * phaseShiftStepImag;
        currentPhaseShiftImag =
          currentPhaseShiftReal * phaseShiftStepImag +
          currentPhaseShiftImag * phaseShiftStepReal;
        currentPhaseShiftReal = nextPhaseShiftReal;
      }
    }
  }
}
