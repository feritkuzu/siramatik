declare module "escpos" {
  export default class Printer {
    constructor(device: any);
    align(align: "lt" | "ct" | "rt"): this;
    style(style: "b" | "i" | "u" | "normal"): this;
    size(width: number, height: number): this;
    text(text: string): this;
    cut(): this;
    close(): Promise<void>;
  }
}
