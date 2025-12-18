declare const Buffer; //To silence TypeScript bug? in Buffer.from(-->[0x0d, 0x0a]<--) Maybe I gonna need some help here...

import { exec } from "child_process";
import { VEDirectData, VEDirectParser } from "./ve-direct";
import { MPPTDeviceData, UnsupportedDeviceData, VEDirectPnPDeviceData, BMVDeviceData } from "./device-data";
import { DelimiterParser, SerialPort } from "serialport";
import { timeout } from "./utils";


interface VEDirectPnPParameters {
  VEDirectDevicesPath?: string;
  customVEDirectDevicesPaths?: Array<string>;
  dataTimeout?: number;
  deleteDataWhenTimeout?: boolean;
  deviceConnectionAutoRepair?: boolean;
}

interface VEDirectPnPEventData {
  message?: string,
  dataDump?: any,
  eventName?: string
}

interface VEDirectPnPFlags {
  requestedInit: boolean;
  initialized: boolean;
  deviceRelationsSetCount: number;
  resetRequested: boolean;
}
interface VEDirectPnPDeviceRelations {
  mainBatteryDeviceId?: string;
  mainMPPTDeviceId?: string;
  mainInverterDeviceId?: string;
  mainChargerDeviceId?: string;
}

export default class VEDirectPnP {
  #version: number;
  #parameters: VEDirectPnPParameters;
  #listenersStack: Array<Function>;
  #VEDirectDevicesData: { [key: string]: VEDirectData };
  #VEDirectDevicesDataMapped: { [key: string]: VEDirectPnPDeviceData };
  #serialPorts: Array<SerialPort>;
  #flags: VEDirectPnPFlags;
  #deviceRelations: VEDirectPnPDeviceRelations;
  #dataTimeoutIntervalCheck: NodeJS.Timeout | null;
  constructor({ VEDirectDevicesPath = "/dev/serial/by-id/", customVEDirectDevicesPaths = [], dataTimeout = 60, deleteDataWhenTimeout, deviceConnectionAutoRepair }: VEDirectPnPParameters, deviceRelations?: VEDirectPnPDeviceRelations) {
    this.#version = 0.30;
    this.#parameters = {
      VEDirectDevicesPath,
      customVEDirectDevicesPaths,
      dataTimeout,
      deleteDataWhenTimeout,
      deviceConnectionAutoRepair
    };
    this.#listenersStack = [];
    this.#VEDirectDevicesData = {};
    this.#VEDirectDevicesDataMapped = {};
    this.#serialPorts = [];
    this.#flags = {
      requestedInit: false,
      initialized: false,
      deviceRelationsSetCount: 0,
      resetRequested: false
    }
    this.#deviceRelations = deviceRelations ?? {};
    this.#dataTimeoutIntervalCheck = null;
    this.init();
  }

  init() {
    if (!this.#flags.requestedInit && !this.#flags.initialized) {
      this.#flags = { ...this.#flags, requestedInit: true };
      this.#initVEDirectDataStreamFromAllDevices().then(() => {
        this.#flags = { ...this.#flags, initialized: true };
        this.#dataTimeoutIntervalCheck = setInterval(() => this.#checkDataTimeoutNTryRepair, this.#parameters.dataTimeout);
        this.#emitEvent("stream-init", {
          message: "VE.Direct devices data stream init"
        });

      }).catch(() => {
        this.#flags = { ...this.#flags, requestedInit: false, initialized: false };
        this.#emitEvent("error", {
          message: "Failed to get data from VE.Direct devices"
        });
      });
    }
  }

  #checkDataTimeoutNTryRepair() {
    const timeoutTime = (new Date().getTime() + (this.#parameters.dataTimeout * 1000));
    const allData = Object.values(this.#VEDirectDevicesDataMapped);
    const timeoutedData = allData.find(data => data.VEDirectData.dataTimeStamp > timeoutTime);

    if (timeoutedData) {
      console.warn(`VEDirectPnP - Device ${timeoutedData.deviceId} data timeout`);
      if (this.#parameters.deleteDataWhenTimeout) {
        delete this.#VEDirectDevicesDataMapped[timeoutedData.deviceId];
      }
      if (this.#parameters.deviceConnectionAutoRepair) {
        console.warn(`VEDirectPnP - AutoRepair feature will now restart all ports`);
        this.reset();
      }
    }
  }

  on(event: string, callback: Function): void {
    const listener = (eventEmmited: string, eventData?: VEDirectPnPEventData) => {
      if (event === eventEmmited || event === "all") {
        callback(eventData);
      }
    }
    this.#listenersStack.push(listener);
  }

  getVersion() {
    return this.#version;
  }

  destroy(callback?: Function) {
    clearInterval(this.#dataTimeoutIntervalCheck);
    if (this.#serialPorts.length > 0) {
      this.#closeSerialPorts().then(() => {
        this.#flags = { ...this.#flags, requestedInit: false, initialized: false };
        this.#emitEvent("stream-destroy", {
          message: "VE.Direct devices data stream has been destroyed"
        });
        if (callback) callback();
      }).catch(() => {
        this.#emitEvent("error", {
          message: "Something went wrong trying to destroy VE.Direct devices data stream"
        });
      })
    }
  }

  getDevicesData() {
    return this.#VEDirectDevicesDataMapped;
  }

  getBatteriesData() {
    return this.getDevicesDataByType("BMV");
  }

  getBatteryData(deviceId?: string): BMVDeviceData {
    if (deviceId && this.#VEDirectDevicesDataMapped[deviceId]?.deviceType === "BMV") {
      return this.#VEDirectDevicesDataMapped[deviceId] as BMVDeviceData;
    }
    const mainBatteryDeviceId = this.#deviceRelations?.mainBatteryDeviceId;
    if (mainBatteryDeviceId) {
      return this.#VEDirectDevicesDataMapped[mainBatteryDeviceId] as BMVDeviceData;
    }
    return null;
  }

  getMPPTData(deviceId?: string): MPPTDeviceData {
    if (deviceId && this.#VEDirectDevicesDataMapped[deviceId]?.deviceType === "MPPT") {
      return this.#VEDirectDevicesDataMapped[deviceId] as MPPTDeviceData;
    }
    const mainMPPTDeviceId = this.#deviceRelations?.mainMPPTDeviceId;
    if (mainMPPTDeviceId) {
      return this.#VEDirectDevicesDataMapped[mainMPPTDeviceId] as MPPTDeviceData;
    }
    return null;
  }

  getInvertersData() {
    return this.getDevicesDataByType("Inverter");
  }

  getChargersData() {
    return this.getDevicesDataByType("Charger");
  }

  getMPPTsData() {
    return this.getDevicesDataByType("MPPT");
  }

  getDevicesDataByType(deviceType: string) {
    return Object.values(this.#VEDirectDevicesDataMapped).filter(device => device.deviceType === deviceType);
  }

  reset() {
    this.destroy(() => {
      this.#clean();
      if (!this.#flags.requestedInit && !this.#flags.initialized && !this.#flags.resetRequested) {
        this.#flags = { ...this.#flags, requestedInit: true, resetRequested: true };
        this.#initVEDirectDataStreamFromAllDevices().then(() => {
          this.#flags = { ...this.#flags, initialized: true, resetRequested: false };
          this.#dataTimeoutIntervalCheck = setInterval(() => this.#checkDataTimeoutNTryRepair, this.#parameters.dataTimeout);
        }).catch(() => {
          this.#flags = { ...this.#flags, requestedInit: false, initialized: false, resetRequested: false };
          this.#emitEvent("error", {
            message: "Failed to get data from VE.Direct devices"
          });
        });
      }
    });
  }

  //END OF PUBLIC METHODS

  #emitEvent(event: string, eventData?: VEDirectPnPEventData) {
    for (const listener of this.#listenersStack) {
      listener(event, { ...eventData, ...{ eventName: event } });
    }
  }

  #getVictronDeviceSN(VEDirectData: VEDirectData) {
    return VEDirectData["SER#"] ?? null;
  }

  #getDeviceVEAdapterSN(VEDirectDevicePath: string) {
    return VEDirectDevicePath?.match(/Direct_cable_([^-]+)/)[1] ?? null;
  }


  #mapVictronDeviceData(deviceData: VEDirectData, deviceId: string, deviceVEAdapterSN: string, deviceVEAdapterPath: string): VEDirectPnPDeviceData {
    if (!isNaN(deviceData["MPPT"])) {
      return new MPPTDeviceData(deviceData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath);
    }
    else if (!isNaN(deviceData["SOC"])) {
      return new BMVDeviceData(deviceData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath);
    }
    else {
      return new UnsupportedDeviceData(deviceData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath);
    }
  }

  #clean() {
    this.#VEDirectDevicesData = {};
  }

  #closeSerialPorts() {
    const handlePortsClose = () => {
      return new Promise<void>(async (resolve, reject) => {
        if (this.#serialPorts.length > 0) {
          const serialPortClosePromises = this.#serialPorts.filter(s => s.isOpen).map((serialPort) => () => {
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

          try {
            for (const closePromise of serialPortClosePromises) {
              await closePromise();
            }
            this.#serialPorts = [];
            resolve();
          }
          catch (error) {
            console.error("VEDirectPnP - Error trying to close synchronously existing connections", error);
            reject();
          }
        }
        else {
          reject();
        }
      });
    }
    return Promise.race([handlePortsClose(), timeout(60000, "VEDirectPnP - Timeout error trying to close synchronously existing connections")])
  }

  #updateVEDirectDataDeviceData(VEDirectData: VEDirectData, deviceId: string, vedirectSerialNumber: string, deviceVEAdapterPath: string) {

    const previousVEDirectRawData = this.#VEDirectDevicesData[deviceId] ?? {};
    const deviceNewData = {
      ...previousVEDirectRawData, ...{ ...VEDirectData, dataTimeStamp: new Date().getTime() }
    };

    this.#VEDirectDevicesData = {
      ...this.#VEDirectDevicesData,
      [deviceId]: deviceNewData
    };

    const deviceNewDataMapped = this.#mapVictronDeviceData(deviceNewData, deviceId, vedirectSerialNumber, deviceVEAdapterPath);
    this.#VEDirectDevicesDataMapped = {
      ...this.#VEDirectDevicesDataMapped,
      [deviceId]: deviceNewDataMapped
    };

    if (this.#flags.deviceRelationsSetCount < Object.keys(this.#VEDirectDevicesData).length) {
      this.#setDeviceRelations();
    }
  }

  #setDeviceRelations() {
    const newDeviceRelations = { ...this.#deviceRelations };
    if (!this.#deviceRelations?.mainBatteryDeviceId) {
      const batteryDeviceId = this.getBatteriesData()[0]?.deviceId ?? null;
      newDeviceRelations.mainBatteryDeviceId = batteryDeviceId;
    }
    if (!this.#deviceRelations?.mainMPPTDeviceId) {
      const mmptDeviceId = this.getMPPTsData()[0]?.deviceId ?? null;
      newDeviceRelations.mainMPPTDeviceId = mmptDeviceId;
    }
    if (!this.#deviceRelations?.mainInverterDeviceId) {
      const inverterDeviceId = this.getInvertersData()[0]?.deviceId ?? null;
      newDeviceRelations.mainInverterDeviceId = inverterDeviceId;
    }
    if (!this.#deviceRelations?.mainChargerDeviceId) {
      const chargerDeviceId = this.getChargersData()[0]?.deviceId ?? null;
      newDeviceRelations.mainChargerDeviceId = chargerDeviceId;
    }
    this.#deviceRelations = newDeviceRelations;
    this.#flags = { ... this.#flags, deviceRelationsSetCount: this.#flags.deviceRelationsSetCount + 1 };
  }

  #getVEDirectDevicesAvailable() {
    return new Promise<Array<string>>((resolve, reject) => {
      exec(`ls ${this.#parameters.VEDirectDevicesPath}`, (error, stdout, stderr) => {
        const errorData = error || stderr;
        if (errorData) {
          this.#emitEvent("error", {
            message: "Failed to get available VE.Direct devices, try with customVEDirectDevicesPaths option.",
            dataDump: errorData
          });
          reject([]);
          return;
        }
        const rawConsoleResponse = stdout.split('\n');
        const validVEDirectInterfaces = rawConsoleResponse.filter((deviceId) => deviceId.indexOf("VE_Direct") !== -1);
        const absoluteDevicesPath = validVEDirectInterfaces.map((device) => {
          const absoluteDevicePath = this.#parameters.VEDirectDevicesPath + device;
          this.#emitEvent("interface-found", {
            message: "Found VE.Direct serial port interface",
            dataDump: absoluteDevicePath
          });
          return absoluteDevicePath;
        });
        resolve(absoluteDevicesPath);
      });
    });
  }

  #initVEDirectDataStreamFromAllDevices() {
    return new Promise<void>((resolve, reject) => {
      if (this.#parameters.customVEDirectDevicesPaths && this.#parameters.customVEDirectDevicesPaths.length > 0) {
        const devicesPromises = this.#parameters.customVEDirectDevicesPaths.map((devicePath, deviceIndex) => this.#initDataStreamFromVEDirect(devicePath, deviceIndex));
        Promise.all(devicesPromises).then(() => {
          resolve();
        }).catch(() => {
          reject();
        });
      }
      else {
        this.#getVEDirectDevicesAvailable().then((devicesPathsFound) => {
          const devicesPromises = devicesPathsFound.map((devicePath, deviceIndex) => this.#initDataStreamFromVEDirect(devicePath, deviceIndex));
          Promise.all(devicesPromises).then(() => {
            resolve();
          });
        }).catch(() => {
          reject();
        });
      }
    });
  }

  #initDataStreamFromVEDirect(devicePath: string, deviceIndex: number) {
    return new Promise<void>((resolve, reject) => {
      const serialport = new SerialPort({
        path: devicePath,
        baudRate: 19200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      }, (err: Error | null) => {
        if (err) {
          this.#emitEvent("error", {
            message: `Device ${devicePath} serial port error`,
            dataDump: err
          });
          this.#VEDirectDevicesData = {};
          reject();
        }
      });

      serialport.on("open", () => {
        this.#emitEvent("device-connection-open", {
          message: "VE.Direct device connected through serial port",
          dataDump: devicePath
        });
      });

      serialport.on('error', (err) => {
        this.#emitEvent("device-connection-error", {
          message: "VE.Direct device connection error through serial port",
          dataDump: {
            devicePath: devicePath,
            errorDataDump: err
          }
        });
      })

      this.#serialPorts.push(serialport);

      const delimiter = new DelimiterParser({
        delimiter: Buffer.from([0x0d, 0x0a], 'hex'),
        includeDelimiter: false
      });

      const VEDParser = new VEDirectParser();
      serialport.pipe(delimiter).pipe(VEDParser);

      VEDParser.on("data", (VEDirectRawData) => {
        const deviceSerialNumber = this.#getVictronDeviceSN(VEDirectRawData);
        const vedirectSerialNumber = this.#getDeviceVEAdapterSN(devicePath);
        const deviceId = deviceSerialNumber ? deviceSerialNumber : vedirectSerialNumber;

        if (!deviceId) {
          this.#emitEvent("error", {
            message: "Cannot assign a device id",
            dataDump: VEDirectData
          });
          return;
        }

        if (!this.#VEDirectDevicesData[deviceId]) {
          resolve();
        }
        this.#updateVEDirectDataDeviceData(VEDirectRawData, deviceId, vedirectSerialNumber, devicePath);
      });
    });
  }
}



