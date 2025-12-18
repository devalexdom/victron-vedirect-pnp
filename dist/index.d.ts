import { MPPTDeviceData, VEDirectPnPDeviceData, BMVDeviceData } from "./device-data";
interface VEDirectPnPParameters {
    VEDirectDevicesPath?: string;
    customVEDirectDevicesPaths?: Array<string>;
    dataTimeout?: number;
    deleteDataWhenTimeout?: boolean;
    deviceConnectionAutoRepair?: boolean;
}
interface VEDirectPnPDeviceRelations {
    mainBatteryDeviceId?: string;
    mainMPPTDeviceId?: string;
    mainInverterDeviceId?: string;
    mainChargerDeviceId?: string;
}
export default class VEDirectPnP {
    #private;
    constructor({ VEDirectDevicesPath, customVEDirectDevicesPaths, dataTimeout, deleteDataWhenTimeout, deviceConnectionAutoRepair }: VEDirectPnPParameters, deviceRelations?: VEDirectPnPDeviceRelations);
    init(): void;
    on(event: string, callback: Function): void;
    getVersion(): number;
    destroy(callback?: Function): void;
    getDevicesData(): {
        [key: string]: VEDirectPnPDeviceData;
    };
    getBatteriesData(): VEDirectPnPDeviceData[];
    getBatteryData(deviceId?: string): BMVDeviceData;
    getMPPTData(deviceId?: string): MPPTDeviceData;
    getInvertersData(): VEDirectPnPDeviceData[];
    getChargersData(): VEDirectPnPDeviceData[];
    getMPPTsData(): VEDirectPnPDeviceData[];
    getDevicesDataByType(deviceType: string): VEDirectPnPDeviceData[];
    reset(): void;
}
export {};
