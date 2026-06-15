declare module 'lunar-javascript' {
  export class Lunar {
    getDay(): number;
    getMonth(): number;
    getYear(): number;
  }
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
  }
}
