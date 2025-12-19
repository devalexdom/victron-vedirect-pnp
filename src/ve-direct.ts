import { Transform } from "stream";

export class VEDirectData {
  //Protocol version 3.33 (06 June 2023)
  V: number;
  V2?: number;
  V3?: number;
  VS?: number;
  VM?: number;
  DM?: number;
  VPV?: number;
  PPV?: number;
  I?: number;
  I2?: number;
  I3?: number;
  IL?: number;
  P?: number;
  CE?: number
  SOC?: number;
  TTG?: number;
  AR?: number;
  OR?: number;
  H1?: number;
  H2?: number;
  H3?: number;
  H4?: number;
  H5?: number;
  H6?: number;
  H7?: number;
  H8?: number;
  H9?: number;
  H10?: number;
  H11?: number;
  H12?: number;
  H13?: number;
  H14?: number;
  H15?: number;
  H16?: number;
  H17?: number;
  H18?: number;
  H19?: number;
  H20?: number;
  H21?: number;
  H22?: number;
  H23?: number;
  ERR?: number;
  CS?: number;
  BMV?: number;
  FW?: number;
  FWE?: number;
  PID?: number;
  HSDS?: number;
  MODE?: number;
  AC_OUT_V?: number;
  AC_OUT_I?: number;
  AC_OUT_S?: number;
  WARN?: number;
  MPPT?: number;
  ["SER#"]?: string;
  Relay?: string;
  Alarm?: string;
  LOAD?: string;
  T?: number;
  dataTimeStamp: number;
  MON?: any;
  DC_IN_V?: number;
  DC_IN_I?: number;
  DC_IN_P?: number;

  constructor(VEDirectRawData: Object) {
    for (const key in VEDirectRawData) {
      if (isNaN(Number(VEDirectRawData[key]))) {
        this[key] = VEDirectRawData[key];
      }
      else {
        this[key] = parseInt(VEDirectRawData[key]);
      }
    }
  }

}

export class VEDirectParser extends Transform {
  buffer: Buffer;
  rawDataBlock: Object;
  #bypassChecksumOption: boolean;
  constructor(bypassChecksum = false) {
    super({
      readableObjectMode: true,
    });
    this.#bypassChecksumOption = bypassChecksum;
    this.buffer = Buffer.alloc(0);
    this.rawDataBlock = {};
  }

  isChecksumValid() {
    if (this.#bypassChecksumOption) {
      return true;
    }
    return (this.buffer.reduce((prev, curr) => (prev + curr) & 255, 0) === 0);
  }

  _transform(dataChunk, encoding, callback) {
    const [key, value] = dataChunk.toString().split('\t');

    if (key[0] === ':') {
      callback();
      return;
    }

    this.buffer = Buffer.concat([this.buffer, Buffer.from([0x0d, 0x0a]), dataChunk]);

    if (key === "Checksum") {
      if (this.isChecksumValid()) {
        this.push(this.rawDataBlock);
      }

      this.buffer = Buffer.alloc(0);
      this.rawDataBlock = {};
    } else {
      this.rawDataBlock[key] = value;
    }

    callback();
  }
}