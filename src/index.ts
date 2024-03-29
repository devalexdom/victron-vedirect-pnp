declare const Buffer; //To silence TypeScript bug? in Buffer.from(-->[0x0d, 0x0a]<--) Maybe I gonna need some help here...

import { exec } from "child_process";
import { VEDirectData, VEDirectParser } from "./ve-direct";
import SerialPort from "serialport";
import { VEDirectPnP_MPPTDeviceData, VEDirectPnP_UnsupportedDeviceData, IVEDirectPnP_DeviceData, VEDirectPnP_BMVDeviceData } from "./device-data";


interface IVEDirectPnP_Parameters {
  VEDirectDevicesPath?: string;
  customVEDirectDevicesPaths?: Array<string>;
}

interface IVEDirectPnP_EventData {
  message?: string,
  dataDump?: any,
  eventName?: string
}


export default class VEDirectPnP {
  version: number;
  parameters: IVEDirectPnP_Parameters;
  currentEvent: string;
  listenersStack: Array<Function>;
  devicesVEDirectData: { [key: string]: Object }
  serialPorts: Array<SerialPort>;
  fluidModeReady: boolean;
  constructor({ VEDirectDevicesPath = "/dev/serial/by-id/", customVEDirectDevicesPaths = [] } = {}) {
    this.version = 0.10;
    this.parameters = {
      VEDirectDevicesPath,
      customVEDirectDevicesPaths
    };
    this.listenersStack = [];
    this.devicesVEDirectData = {};
    this.serialPorts = [];
    this.fluidModeReady = false;
    this.init();
  }

  on(event: string, callback: Function): void {
    const listener = (eventEmmited: string, eventData?: IVEDirectPnP_EventData) => {
      if (event === eventEmmited || event === "all") {
        callback(eventData);
      }
    }
    this.listenersStack.push(listener);
  }

  emitEvent(event: string, eventData?: IVEDirectPnP_EventData) {
    for (const listener of this.listenersStack) {
      listener(event, { ...eventData, ...{ eventName: event } });
    }
  }

  getVictronDeviceSN(VEDirectData: VEDirectData, VEDirectDevicePath: string, deviceIndex: number) {
    const deviceSerialNumber = VEDirectData["SER#"];
    if (deviceSerialNumber) {
      return deviceSerialNumber;
    }
    else {
      const vedirectSerialNumber = VEDirectDevicePath?.match(/Direct_cable_([^-]+)/)[1];
      if (vedirectSerialNumber) {
        return vedirectSerialNumber;
      }
    }
    return `unknown_id_victron_device-${deviceIndex}`;
  }

  mapVictronDeviceData(devicesData: { [key: string]: Object }): { [key: string]: IVEDirectPnP_DeviceData } {
    const devicesDataMapped = {};
    for (const deviceSN in devicesData) {
      const deviceData = devicesData[deviceSN];
      if (!isNaN(deviceData["MPPT"])) {
        devicesDataMapped[deviceSN] = new VEDirectPnP_MPPTDeviceData(deviceData);
      }
      else if (!isNaN(deviceData["SOC"])) {
        devicesDataMapped[deviceSN] = new VEDirectPnP_BMVDeviceData(deviceData);
      }
      else {
        devicesDataMapped[deviceSN] = new VEDirectPnP_UnsupportedDeviceData(deviceData);
      }
    }
    return devicesDataMapped;
  }

  init() {
    this.initVEDirectDataStreamFromAllDevices().then(() => {
      this.emitEvent("stream-init", {
        message: "VE.Direct devices data stream init"
      });
    }).catch(() => {
      this.emitEvent("error", {
        message: "Failed to get data from VE.Direct devices"
      });
    });
  }

  clean() {
    this.devicesVEDirectData = {};
  }

  reset() {
    this.destroy(() => {
      this.clean();
      this.init();
    });
  }

  closeSerialPorts() {
    return new Promise<void>((resolve, reject) => {
      if (this.serialPorts.length > 0) {
        const serialPortClosePromises = this.serialPorts.map((serialPort) => {
          return new Promise<void>((resolve, reject) => {
            serialPort.close((error) => {
              if (error) {
                console.error(error);
                reject();
              }
              else {
                resolve();
              }
            })
          });
        });
        Promise.all(serialPortClosePromises)
          .then(() => {
            this.serialPorts = [];
            resolve();
          }).catch(() => reject)
      }
      else {
        reject();
      }
    });
  }

  destroy(callback?: Function) {
    if (this.serialPorts.length > 0) {
      this.closeSerialPorts().then(() => {
        this.emitEvent("stream-destroy", {
          message: "VE.Direct devices data stream has been destroyed"
        });
        if (callback) callback();
      }).catch(() => {
        this.emitEvent("error", {
          message: "Something went wrong trying to destroy VE.Direct devices data stream"
        });
      })
    }
  }

  getDevicesData() {
    return this.mapVictronDeviceData(this.devicesVEDirectData);
  }

  updateVEDirectDataDeviceData(VEDirectRawData: VEDirectData, devicePath: string, deviceIndex: number) {
    const serialNumber = this.getVictronDeviceSN(VEDirectRawData, devicePath, deviceIndex);
    if (!serialNumber) {
      this.emitEvent("error", {
        message: "Device does not have a valid serial number.",
        dataDump: VEDirectRawData
      });
      return;
    }

    const previousVEDirectRawData = this.devicesVEDirectData[serialNumber] ?? {};

    this.devicesVEDirectData = {
      ...this.devicesVEDirectData,
      [serialNumber]: {
        ...previousVEDirectRawData, ...{ ...VEDirectRawData, dataTimeStamp: new Date().getTime() }
      }
    };
  }

  getVEDirectDevicesAvailable() {
    return new Promise<Array<string>>((resolve, reject) => {
      exec(`ls ${this.parameters.VEDirectDevicesPath}`, (error, stdout, stderr) => {
        const errorData = error || stderr;
        if (errorData) {
          this.emitEvent("error", {
            message: "Failed to get available VE.Direct devices, try with customVEDirectDevicesPaths option.",
            dataDump: errorData
          });
          reject([]);
          return;
        }
        const rawConsoleResponse = stdout.split('\n');
        const validVEDirectInterfaces = rawConsoleResponse.filter((deviceId) => deviceId.indexOf("VE_Direct") !== -1);
        const absoluteDevicesPath = validVEDirectInterfaces.map((device) => {
          const absoluteDevicePath = this.parameters.VEDirectDevicesPath + device;
          this.emitEvent("interface-found", {
            message: "Found VE.Direct serial port interface",
            dataDump: absoluteDevicePath
          });
          return absoluteDevicePath;
        });
        resolve(absoluteDevicesPath);
      });
    });
  }

  initVEDirectDataStreamFromAllDevices() {
    return new Promise<void>((resolve, reject) => {
      if (this.parameters.customVEDirectDevicesPaths && this.parameters.customVEDirectDevicesPaths.length > 0) {
        const devicesPromises = this.parameters.customVEDirectDevicesPaths.map((devicePath, deviceIndex) => this.initDataStreamFromVEDirect(devicePath, deviceIndex));
        Promise.all(devicesPromises).then(() => {
          resolve();
        }).catch(() => {
          reject();
        });
      }
      else {
        this.getVEDirectDevicesAvailable().then((devicesPathsFound) => {
          const devicesPromises = devicesPathsFound.map((devicePath, deviceIndex) => this.initDataStreamFromVEDirect(devicePath, deviceIndex));
          Promise.all(devicesPromises).then(() => {
            resolve();
          });
        }).catch(() => {
          reject();
        });
      }
    });
  }

  initDataStreamFromVEDirect(devicePath: string, deviceIndex: number) {
    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort(devicePath, {
        baudRate: 19200,
        dataBits: 8,
        parity: 'none'
      }, (err) => {
        if (err) {
          this.emitEvent("error", {
            message: `Device ${devicePath} serial port error`,
            dataDump: err
          });
          this.devicesVEDirectData = {};
          reject();
        }
      });

      port.on("open", () => {
        this.emitEvent("device-connection-open", {
          message: "VE.Direct device connected through serial port",
          dataDump: devicePath
        });
      });

      port.on('error', (err) => {
        this.emitEvent("device-connection-error", {
          message: "VE.Direct device connection error through serial port",
          dataDump: {
            devicePath: devicePath,
            errorDataDump: err
          }
        });
      })

      this.serialPorts.push(port);

      const delimiter = new SerialPort.parsers.Delimiter({
        delimiter: Buffer.from([0x0d, 0x0a], 'hex'),
        includeDelimiter: false
      });

      const VEDParser = new VEDirectParser();
      port.pipe(delimiter).pipe(VEDParser);

      VEDParser.on("data", (VEDirectRawData) => {
        if (!this.devicesVEDirectData[this.getVictronDeviceSN(VEDirectRawData, devicePath, deviceIndex)]) {
          resolve();
        }
        this.updateVEDirectDataDeviceData(VEDirectRawData, devicePath, deviceIndex);
      });
    });
  }
}



