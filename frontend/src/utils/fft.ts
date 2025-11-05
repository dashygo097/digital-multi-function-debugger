interface Complex {
  real: number;
  imag: number;
}

export class FFT {
  private size: number;
  private reversedIndices: Uint32Array;
  private twiddleFactors: Complex[];

  constructor(size: number) {
    if (size <= 0 || (size & (size - 1)) !== 0) {
      throw new Error("FFT size must be a power of 2.");
    }
    this.size = size;
    this.reversedIndices = this.precomputeReversedIndices(size);
    this.twiddleFactors = this.precomputeTwiddleFactors(size);
  }

  private precomputeReversedIndices(size: number): Uint32Array {
    const indices = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let reversed = 0;
      for (let j = 0; j < bits; j++) {
        if ((i >> j) & 1) {
          reversed |= 1 << (bits - 1 - j);
        }
      }
      indices[i] = reversed;
    }
    return indices;
  }

  private precomputeTwiddleFactors(size: number): Complex[] {
    const factors: Complex[] = [];
    for (let i = 0; i < size / 2; i++) {
      const angle = (2 * Math.PI * i) / size;
      factors.push({
        real: Math.cos(angle),
        imag: -Math.sin(angle),
      });
    }
    return factors;
  }

  private transform(x: number[]): Complex[] {
    if (x.length !== this.size) {
      throw new Error(
        `Input data length (${x.length}) does not match FFT size (${this.size}).`,
      );
    }

    const X: Complex[] = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      X[i] = { real: x[this.reversedIndices[i]], imag: 0 };
    }

    for (let s = 1; s <= Math.log2(this.size); s++) {
      const m = 1 << s; // 2^s
      const m_div_2 = m >> 1; // m / 2
      const twiddleStep = this.size / m;

      for (let k = 0; k < this.size; k += m) {
        for (let j = 0; j < m_div_2; j++) {
          const twiddle = this.twiddleFactors[j * twiddleStep];
          const t_real =
            twiddle.real * X[k + j + m_div_2].real -
            twiddle.imag * X[k + j + m_div_2].imag;
          const t_imag =
            twiddle.real * X[k + j + m_div_2].imag +
            twiddle.imag * X[k + j + m_div_2].real;

          const u = X[k + j];

          X[k + j] = {
            real: u.real + t_real,
            imag: u.imag + t_imag,
          };

          X[k + j + m_div_2] = {
            real: u.real - t_real,
            imag: u.imag - t_imag,
          };
        }
      }
    }
    return X;
  }

  public calculate(x: number[]): number[] {
    const complexResult = this.transform(x);
    const magnitudes = new Array(this.size);

    for (let i = 0; i < this.size; i++) {
      const real = complexResult[i].real;
      const imag = complexResult[i].imag;
      magnitudes[i] = (real * real + imag * imag) / this.size;
    }

    return magnitudes;
  }
}
