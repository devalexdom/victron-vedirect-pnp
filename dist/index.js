'use strict';

var child_process = require('child_process');
var stream = require('stream');
var serialport = require('serialport');

class VEDirectData {
    //Protocol version 3.33 (06 June 2023)
    V;
    V2;
    V3;
    VS;
    VM;
    DM;
    VPV;
    PPV;
    I;
    I2;
    I3;
    IL;
    P;
    CE;
    SOC;
    TTG;
    AR;
    OR;
    H1;
    H2;
    H3;
    H4;
    H5;
    H6;
    H7;
    H8;
    H9;
    H10;
    H11;
    H12;
    H13;
    H14;
    H15;
    H16;
    H17;
    H18;
    H19;
    H20;
    H21;
    H22;
    H23;
    ERR;
    CS;
    BMV;
    FW;
    FWE;
    PID;
    HSDS;
    MODE;
    AC_OUT_V;
    AC_OUT_I;
    AC_OUT_S;
    WARN;
    MPPT;
    ["SER#"];
    Relay;
    Alarm;
    LOAD;
    T;
    dataTimeStamp;
    MON;
    DC_IN_V;
    DC_IN_I;
    DC_IN_P;
    constructor(VEDirectRawData) {
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
class VEDirectParser extends stream.Transform {
    buffer;
    rawDataBlock;
    constructor() {
        super({
            readableObjectMode: true,
        });
        this.buffer = Buffer.alloc(0);
        this.rawDataBlock = {};
    }
    isChecksumValid() {
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
        }
        else {
            this.rawDataBlock[key] = value;
        }
        callback();
    }
}

const deviceName = {
    768: "BlueSolar MPPT 70|15",
    41087: "All-In-1 SmartSolar MPPT 75/15 12V",
    41024: "BlueSolar MPPT 75|50",
    41025: "BlueSolar MPPT 150|35",
    41026: "BlueSolar MPPT 75|15",
    41027: "BlueSolar MPPT 100|15",
    41028: "BlueSolar MPPT 100|30",
    41029: "BlueSolar MPPT 100|50",
    41030: "BlueSolar MPPT 150|70",
    41031: "BlueSolar MPPT 150|100",
    41033: "BlueSolar MPPT 100|50 rev2",
    41034: "BlueSolar MPPT 100|30 rev2",
    41035: "BlueSolar MPPT 150|35 rev2",
    41036: "BlueSolar MPPT 75|10",
    41037: "BlueSolar MPPT 150|45",
    41074: "BlueSolar MPPT 150/45 rev3",
    41038: "BlueSolar MPPT 150|60",
    41039: "BlueSolar MPPT 150|85",
    41040: "SmartSolar MPPT 250|100",
    41041: "SmartSolar MPPT 150|100",
    41042: "SmartSolar MPPT 150|85",
    41043: "SmartSolar MPPT 75|15",
    41044: "SmartSolar MPPT 75|10",
    41045: "SmartSolar MPPT 100|15",
    41046: "SmartSolar MPPT 100|30",
    41047: "SmartSolar MPPT 100|50",
    41048: "SmartSolar MPPT 150|35",
    41049: "SmartSolar MPPT 150|100 rev2",
    41050: "SmartSolar MPPT 150|85 rev2",
    41051: "SmartSolar MPPT 250|70",
    41052: "SmartSolar MPPT 250|85",
    41053: "SmartSolar MPPT 250|60",
    41054: "SmartSolar MPPT 250|45",
    41055: "SmartSolar MPPT 100|20",
    41056: "SmartSolar MPPT 100|20 48V",
    41057: "SmartSolar MPPT 150|45",
    41058: "SmartSolar MPPT 150|60",
    41059: "SmartSolar MPPT 150|70",
    41060: "SmartSolar MPPT 250|85 rev2",
    41061: "SmartSolar MPPT 250|100 rev2",
    41062: "BlueSolar MPPT 100|20",
    41063: "BlueSolar MPPT 100|20 48V",
    41064: "SmartSolar MPPT 250|60 rev2",
    41065: "SmartSolar MPPT 250|70 rev2",
    41066: "SmartSolar MPPT 150|45 rev2",
    41067: "SmartSolar MPPT 150|60 rev2",
    41068: "SmartSolar MPPT 150|70 rev2",
    41069: "SmartSolar MPPT 150|85 rev3",
    41070: "SmartSolar MPPT 150|100 rev3",
    41071: "BlueSolar MPPT 150|45 rev2",
    41072: "BlueSolar MPPT 150|60 rev2",
    41073: "BlueSolar MPPT 150|70 rev2",
    41075: "SmartSolar MPPT 150/45 rev3",
    41218: "SmartSolar MPPT VE.Can 150/70",
    41219: "SmartSolar MPPT VE.Can 150/45",
    41220: "SmartSolar MPPT VE.Can 150/60",
    41221: "SmartSolar MPPT VE.Can 150/85",
    41222: "SmartSolar MPPT VE.Can 150/100",
    41223: "SmartSolar MPPT VE.Can 250/45",
    41224: "SmartSolar MPPT VE.Can 250/60",
    41225: "SmartSolar MPPT VE.Can 250/70",
    41226: "SmartSolar MPPT VE.Can 250/85",
    41227: "SmartSolar MPPT VE.Can 250/100",
    41228: "SmartSolar MPPT VE.Can 150/70 rev2",
    41229: "SmartSolar MPPT VE.Can 150/85 rev2",
    41230: "SmartSolar MPPT VE.Can 150/100 rev2",
    41231: "BlueSolar MPPT VE.Can 150/100",
    41234: "BlueSolar MPPT VE.Can 250/70",
    41235: "BlueSolar MPPT VE.Can 250/100",
    41236: "SmartSolar MPPT VE.Can 250/70 rev2",
    41237: "SmartSolar MPPT VE.Can 250/100 rev2",
    41238: "SmartSolar MPPT VE.Can 250/85 rev2",
    41239: "BlueSolar MPPT VE.Can 150/100 rev2",
    41968: "Smart BuckBoost 12V/12V-50A",
    41865: "SmartShunt 500A/50mV",
    41866: "SmartShunt 1000A/50mV",
    41867: "SmartShunt 2000A/50mV",
    41857: "BMV-712 Smart",
    41858: "BMV-710H Smart",
    41859: "BMV-712 Smart Rev2",
};

var StatusMessage;
(function (StatusMessage) {
    StatusMessage[StatusMessage["Off"] = 0] = "Off";
    StatusMessage[StatusMessage["Low power"] = 1] = "Low power";
    StatusMessage[StatusMessage["Fault"] = 2] = "Fault";
    StatusMessage[StatusMessage["Bulk"] = 3] = "Bulk";
    StatusMessage[StatusMessage["Absorption"] = 4] = "Absorption";
    StatusMessage[StatusMessage["Float"] = 5] = "Float";
    StatusMessage[StatusMessage["Storage"] = 6] = "Storage";
    StatusMessage[StatusMessage["Equalize (manual)"] = 7] = "Equalize (manual)";
    StatusMessage[StatusMessage["Inverting"] = 9] = "Inverting";
    StatusMessage[StatusMessage["Power supply"] = 11] = "Power supply";
    StatusMessage[StatusMessage["Starting-up"] = 245] = "Starting-up";
    StatusMessage[StatusMessage["Repeated absorption"] = 246] = "Repeated absorption";
    StatusMessage[StatusMessage["Auto equalize / Recondition"] = 247] = "Auto equalize / Recondition";
    StatusMessage[StatusMessage["BatterySafe"] = 247] = "BatterySafe";
    StatusMessage[StatusMessage["External Control"] = 252] = "External Control";
})(StatusMessage || (StatusMessage = {}));
var ErrorMessage;
(function (ErrorMessage) {
    ErrorMessage[ErrorMessage[""] = 0] = "";
    ErrorMessage[ErrorMessage["Battery voltage too high"] = 2] = "Battery voltage too high";
    ErrorMessage[ErrorMessage["Charger temperature too high"] = 17] = "Charger temperature too high";
    ErrorMessage[ErrorMessage["Charger over current"] = 18] = "Charger over current";
    ErrorMessage[ErrorMessage["Charger current reversed"] = 19] = "Charger current reversed";
    ErrorMessage[ErrorMessage["Bulk time limit exceeded"] = 20] = "Bulk time limit exceeded";
    ErrorMessage[ErrorMessage["Current sensor issue (sensor bias/sensor broken)"] = 21] = "Current sensor issue (sensor bias/sensor broken)";
    ErrorMessage[ErrorMessage["Terminals overheated"] = 26] = "Terminals overheated";
    ErrorMessage[ErrorMessage["Converter issue (dual converter models only)"] = 28] = "Converter issue (dual converter models only)";
    ErrorMessage[ErrorMessage["Input voltage too high (solar panel)"] = 33] = "Input voltage too high (solar panel)";
    ErrorMessage[ErrorMessage["Input current too high (solar panel)"] = 34] = "Input current too high (solar panel)";
    ErrorMessage[ErrorMessage["Input shutdown (due to excessive battery voltage)"] = 38] = "Input shutdown (due to excessive battery voltage)";
    ErrorMessage[ErrorMessage["Input shutdown (due to current flow during off mode)"] = 39] = "Input shutdown (due to current flow during off mode)";
    ErrorMessage[ErrorMessage["Lost communication with one of devices"] = 65] = "Lost communication with one of devices";
    ErrorMessage[ErrorMessage["Synchronised charging device configuration issue"] = 66] = "Synchronised charging device configuration issue";
    ErrorMessage[ErrorMessage["BMS connection lost"] = 67] = "BMS connection lost";
    ErrorMessage[ErrorMessage["Network misconfigured"] = 68] = "Network misconfigured";
    ErrorMessage[ErrorMessage["Factory calibration data lost"] = 116] = "Factory calibration data lost";
    ErrorMessage[ErrorMessage["Invalid/incompatible firmware"] = 117] = "Invalid/incompatible firmware";
    ErrorMessage[ErrorMessage["User settings invalid"] = 119] = "User settings invalid";
})(ErrorMessage || (ErrorMessage = {}));
var MPPTMessage;
(function (MPPTMessage) {
    MPPTMessage[MPPTMessage["Off"] = 0] = "Off";
    MPPTMessage[MPPTMessage["Voltage or current limited"] = 1] = "Voltage or current limited";
    MPPTMessage[MPPTMessage["MPP Tracker active"] = 2] = "MPP Tracker active";
})(MPPTMessage || (MPPTMessage = {}));
var AlarmReasonMessage;
(function (AlarmReasonMessage) {
    AlarmReasonMessage[AlarmReasonMessage[""] = 0] = "";
    AlarmReasonMessage[AlarmReasonMessage["Low Voltage"] = 1] = "Low Voltage";
    AlarmReasonMessage[AlarmReasonMessage["High Voltage"] = 2] = "High Voltage";
    AlarmReasonMessage[AlarmReasonMessage["Low SOC"] = 4] = "Low SOC";
    AlarmReasonMessage[AlarmReasonMessage["Low Starter Voltage"] = 8] = "Low Starter Voltage";
    AlarmReasonMessage[AlarmReasonMessage["High Starter Voltage"] = 16] = "High Starter Voltage";
    AlarmReasonMessage[AlarmReasonMessage["Low Temperature"] = 32] = "Low Temperature";
    AlarmReasonMessage[AlarmReasonMessage["High Temperature"] = 64] = "High Temperature";
    AlarmReasonMessage[AlarmReasonMessage["Mid Voltage"] = 128] = "Mid Voltage";
    AlarmReasonMessage[AlarmReasonMessage["Overload"] = 256] = "Overload";
    AlarmReasonMessage[AlarmReasonMessage["DC-ripple"] = 512] = "DC-ripple";
    AlarmReasonMessage[AlarmReasonMessage["Low V AC out"] = 1024] = "Low V AC out";
    AlarmReasonMessage[AlarmReasonMessage["High V AC out"] = 2048] = "High V AC out";
    AlarmReasonMessage[AlarmReasonMessage["Short Circuit"] = 4096] = "Short Circuit";
    AlarmReasonMessage[AlarmReasonMessage["BMS Lockout"] = 8192] = "BMS Lockout";
})(AlarmReasonMessage || (AlarmReasonMessage = {}));
var DeviceType;
(function (DeviceType) {
    DeviceType[DeviceType["MPPT"] = 0] = "MPPT";
    DeviceType[DeviceType["Inverter"] = 1] = "Inverter";
    DeviceType[DeviceType["BMV"] = 2] = "BMV";
    DeviceType[DeviceType["Charger"] = 3] = "Charger";
})(DeviceType || (DeviceType = {}));
var OffReasonMessage;
(function (OffReasonMessage) {
    OffReasonMessage[OffReasonMessage[""] = 0] = "";
    OffReasonMessage[OffReasonMessage["No input power"] = 1] = "No input power";
    OffReasonMessage[OffReasonMessage["Switched off (power switch)"] = 2] = "Switched off (power switch)";
    OffReasonMessage[OffReasonMessage["Switched off (device mode register) "] = 4] = "Switched off (device mode register) ";
    OffReasonMessage[OffReasonMessage["Remote input"] = 8] = "Remote input";
    OffReasonMessage[OffReasonMessage["Protection active"] = 10] = "Protection active";
    OffReasonMessage[OffReasonMessage["Paygo"] = 20] = "Paygo";
    OffReasonMessage[OffReasonMessage["BMS"] = 40] = "BMS";
    OffReasonMessage[OffReasonMessage["Engine shutdown detection"] = 80] = "Engine shutdown detection";
    OffReasonMessage[OffReasonMessage["Analysing input voltage"] = 100] = "Analysing input voltage";
})(OffReasonMessage || (OffReasonMessage = {}));

class UnsupportedDeviceData {
    deviceName;
    deviceType;
    deviceId;
    deviceSN;
    deviceVEAdapterSN;
    deviceVEAdapterPath;
    VEDirectData;
    constructor(VEDirectRawData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath) {
        //VE.Direct -> UnsupportedDeviceData properties mapping
        const data = new VEDirectData(VEDirectRawData);
        this.deviceName = getDeviceName(data["PID"]);
        this.deviceId = deviceId;
        this.deviceSN = data["SER#"] ?? null;
        this.deviceVEAdapterSN = deviceVEAdapterSN;
        this.deviceVEAdapterPath = deviceVEAdapterPath;
        this.deviceType = "Unsupported";
        this.VEDirectData = data;
    }
}
class BMVDeviceData {
    deviceType;
    deviceName;
    deviceId;
    deviceSN;
    deviceVEAdapterSN;
    deviceVEAdapterPath;
    deviceFirmwareVersion;
    batteryMinVoltage;
    batteryMaxVoltage;
    batteryVoltage;
    batteryAuxMinVoltage;
    batteryAuxMaxVoltage;
    batteryAuxVoltage;
    batteryMidPointVoltage;
    batteryMidPointDeviation;
    batteryCurrent;
    batteryChargingCurrent;
    batteryDischargingCurrent;
    batteryPercentage;
    batteryInstantaneousPower;
    batteryTemperature;
    consumedAmpHours;
    cumulativeDrawnAmpHours;
    deepestDischargeAmpHours;
    lastDischargeAmpHours;
    averageDischargeAmpHours;
    chargeCycles;
    fullDischarges;
    automaticSynchronizations;
    hoursSinceLastFullCharge;
    lowMainVoltageAlarms;
    highMainVoltageAlarms;
    lowAuxVoltageAlarms;
    highAuxVoltageAlarms;
    dischargedEnergy;
    chargedEnergy;
    relayState;
    alarmState;
    alarmMessage;
    VEDirectData;
    constructor(VEDirectRawData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath) {
        //VE.Direct -> MPPTDeviceData properties mapping
        const data = new VEDirectData(VEDirectRawData);
        this.deviceName = getDeviceName(data["PID"]);
        this.deviceId = deviceId;
        this.deviceSN = data["SER#"] ?? null;
        this.deviceVEAdapterSN = deviceVEAdapterSN;
        this.deviceType = DeviceType[2];
        this.deviceFirmwareVersion = getDeviceFW(data);
        this.batteryMidPointVoltage = getNullableNumber(data.VM) / 1000; //mV -> V
        this.batteryMidPointDeviation = getNullableNumber(data.DM) / 10;
        this.batteryAuxVoltage = getNullableNumber(data.VS) / 1000; //mV -> V
        this.batteryVoltage = getNullableNumber(data.V) / 1000; //mV -> V
        this.batteryCurrent = getNullableNumber(data.I) / 1000; //mA -> A
        this.batteryChargingCurrent = this.batteryCurrent > 0 ? this.batteryCurrent : 0;
        this.batteryDischargingCurrent = this.batteryCurrent < 0 ? Math.abs(this.batteryCurrent) : 0;
        this.batteryPercentage = getNullableNumber(data.SOC) / 10;
        this.batteryInstantaneousPower = getNullableNumber(data.P); //W
        this.batteryTemperature = getNullableNumber(data.T); //Celsius
        this.consumedAmpHours = getNullableNumber(data.CE) / 1000;
        this.relayState = getStringBoolean(data.Relay);
        this.deepestDischargeAmpHours = getNullableNumber(data.H1) / 1000;
        this.lastDischargeAmpHours = getNullableNumber(data.H2) / 1000;
        this.averageDischargeAmpHours = getNullableNumber(data.H3) / 1000;
        this.chargeCycles = getNullableNumber(data.H4);
        this.fullDischarges = getNullableNumber(data.H5);
        this.cumulativeDrawnAmpHours = getNullableNumber(data.H6) / 1000;
        this.batteryMinVoltage = getNullableNumber(data.H7) / 1000;
        this.batteryMaxVoltage = getNullableNumber(data.H8) / 1000;
        this.hoursSinceLastFullCharge = getNullableNumber(data.H9) / 3600;
        this.automaticSynchronizations = getNullableNumber(data.H10);
        this.lowMainVoltageAlarms = getNullableNumber(data.H11);
        this.highMainVoltageAlarms = getNullableNumber(data.H12);
        this.lowAuxVoltageAlarms = getNullableNumber(data.H13);
        this.highAuxVoltageAlarms = getNullableNumber(data.H14);
        this.batteryAuxMinVoltage = getNullableNumber(data.H15) / 1000;
        this.batteryAuxMaxVoltage = getNullableNumber(data.H16) / 1000;
        this.dischargedEnergy = getNullableNumber(data.H17) / 100; //KWh
        this.chargedEnergy = getNullableNumber(data.H18) / 100; //KWh
        this.alarmState = getStringBoolean(data.Alarm);
        this.alarmMessage = AlarmReasonMessage[data.AR];
        this.deviceVEAdapterPath = deviceVEAdapterPath;
        this.VEDirectData = data;
    }
}
class MPPTDeviceData {
    deviceType;
    deviceName;
    deviceId;
    deviceSN;
    deviceVEAdapterSN;
    deviceVEAdapterPath;
    deviceFirmwareVersion;
    batteryVoltage;
    batteryCurrent;
    batteryChargingPower;
    statusMessage;
    errorMessage;
    mpptMessage;
    maximumPowerToday;
    maximumPowerYesterday;
    totalEnergyProduced;
    energyProducedToday;
    energyProducedYesterday;
    photovoltaicPower;
    photovoltaicVoltage;
    photovoltaicCurrent;
    loadCurrent;
    loadOutputState;
    relayState;
    offReasonMessage;
    daySequenceNumber;
    VEDirectData;
    constructor(VEDirectRawData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath) {
        //VE.Direct -> MPPTDeviceData properties mapping
        const data = new VEDirectData(VEDirectRawData);
        this.deviceName = getDeviceName(data["PID"]);
        this.deviceId = deviceId;
        this.deviceSN = data["SER#"];
        this.deviceVEAdapterSN = deviceVEAdapterSN;
        this.deviceVEAdapterPath = deviceVEAdapterPath;
        this.deviceType = DeviceType[0];
        this.deviceFirmwareVersion = getDeviceFW(data);
        this.batteryVoltage = data["V"] / 1000; //mV -> V
        this.batteryCurrent = data["I"] / 1000; //mA -> A
        this.batteryChargingPower = (this.batteryVoltage * this.batteryCurrent); // W
        this.statusMessage = StatusMessage[data["CS"]];
        this.errorMessage = ErrorMessage[data["ERR"]];
        this.mpptMessage = MPPTMessage[data["MPPT"]];
        this.maximumPowerToday = data["H21"]; // W
        this.maximumPowerYesterday = data["H23"]; // W
        this.totalEnergyProduced = data["H19"] / 100; // kWh
        this.energyProducedToday = data["H20"] / 100; // kWh
        this.energyProducedYesterday = data["H22"] / 100; // kWh
        this.photovoltaicPower = data["PPV"]; // W
        this.photovoltaicVoltage = data["VPV"] / 1000; //mV -> V
        this.photovoltaicCurrent = this.photovoltaicPower / this.photovoltaicVoltage; //A
        this.loadCurrent = data["IL"] ? data["IL"] / 1000 : 0; //mA -> A
        this.loadOutputState = getStringBoolean(data["LOAD"]);
        this.relayState = getStringBoolean(data["Relay"]);
        this.offReasonMessage = OffReasonMessage[data["OR"]];
        this.daySequenceNumber = data["HSDS"];
        this.VEDirectData = data;
    }
}
function getDeviceName(pid) {
    if (deviceName[pid]) {
        return deviceName[pid];
    }
    return "Unknow Victron Device";
}
function getDeviceFW(VEDirectData) {
    const fw = VEDirectData["FW"] || VEDirectData["FWE"];
    return typeof fw === "number" ? fw / 100 : -1;
}
function getStringBoolean(stringBoolean) {
    return stringBoolean === "ON" || stringBoolean === "On";
}
function getNullableNumber(nullableNumber) {
    return nullableNumber ?? 0;
}

const timeout = (ms, errorText = "Timeout") => {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorText)), ms);
    });
};

class VEDirectPnP {
    #version;
    #parameters;
    #listenersStack;
    #VEDirectDevicesData;
    #VEDirectDevicesDataMapped;
    #serialPorts;
    #flags;
    #deviceRelations;
    #dataTimeoutIntervalCheck;
    constructor({ VEDirectDevicesPath = "/dev/serial/by-id/", customVEDirectDevicesPaths = [], dataTimeout = 60, deleteDataWhenTimeout, deviceConnectionAutoRepair }, deviceRelations) {
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
        };
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
    on(event, callback) {
        const listener = (eventEmmited, eventData) => {
            if (event === eventEmmited || event === "all") {
                callback(eventData);
            }
        };
        this.#listenersStack.push(listener);
    }
    getVersion() {
        return this.#version;
    }
    destroy(callback) {
        clearInterval(this.#dataTimeoutIntervalCheck);
        if (this.#serialPorts.length > 0) {
            this.#closeSerialPorts().then(() => {
                this.#flags = { ...this.#flags, requestedInit: false, initialized: false };
                this.#emitEvent("stream-destroy", {
                    message: "VE.Direct devices data stream has been destroyed"
                });
                if (callback)
                    callback();
            }).catch(() => {
                this.#emitEvent("error", {
                    message: "Something went wrong trying to destroy VE.Direct devices data stream"
                });
            });
        }
    }
    getDevicesData() {
        return this.#VEDirectDevicesDataMapped;
    }
    getBatteriesData() {
        return this.getDevicesDataByType("BMV");
    }
    getBatteryData(deviceId) {
        if (deviceId && this.#VEDirectDevicesDataMapped[deviceId]?.deviceType === "BMV") {
            return this.#VEDirectDevicesDataMapped[deviceId];
        }
        const mainBatteryDeviceId = this.#deviceRelations?.mainBatteryDeviceId;
        if (mainBatteryDeviceId) {
            return this.#VEDirectDevicesDataMapped[mainBatteryDeviceId];
        }
        return null;
    }
    getMPPTData(deviceId) {
        if (deviceId && this.#VEDirectDevicesDataMapped[deviceId]?.deviceType === "MPPT") {
            return this.#VEDirectDevicesDataMapped[deviceId];
        }
        const mainMPPTDeviceId = this.#deviceRelations?.mainMPPTDeviceId;
        if (mainMPPTDeviceId) {
            return this.#VEDirectDevicesDataMapped[mainMPPTDeviceId];
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
    getDevicesDataByType(deviceType) {
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
    #emitEvent(event, eventData) {
        for (const listener of this.#listenersStack) {
            listener(event, { ...eventData, ...{ eventName: event } });
        }
    }
    #getVictronDeviceSN(VEDirectData) {
        return VEDirectData["SER#"] ?? null;
    }
    #getDeviceVEAdapterSN(VEDirectDevicePath) {
        return VEDirectDevicePath?.match(/Direct_cable_([^-]+)/)[1] ?? null;
    }
    #mapVictronDeviceData(deviceData, deviceId, deviceVEAdapterSN, deviceVEAdapterPath) {
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
            return new Promise(async (resolve, reject) => {
                if (this.#serialPorts.length > 0) {
                    const serialPortClosePromises = this.#serialPorts.filter(s => s.isOpen).map((serialPort) => () => {
                        return new Promise((resolve, reject) => {
                            serialPort.close((error) => {
                                if (error) {
                                    console.error(error);
                                    reject();
                                }
                                else {
                                    resolve();
                                }
                            });
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
        };
        return Promise.race([handlePortsClose(), timeout(60000, "VEDirectPnP - Timeout error trying to close synchronously existing connections")]);
    }
    #updateVEDirectDataDeviceData(VEDirectData, deviceId, vedirectSerialNumber, deviceVEAdapterPath) {
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
        this.#flags = { ...this.#flags, deviceRelationsSetCount: this.#flags.deviceRelationsSetCount + 1 };
    }
    #getVEDirectDevicesAvailable() {
        return new Promise((resolve, reject) => {
            child_process.exec(`ls ${this.#parameters.VEDirectDevicesPath}`, (error, stdout, stderr) => {
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
        return new Promise((resolve, reject) => {
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
    #initDataStreamFromVEDirect(devicePath, deviceIndex) {
        return new Promise((resolve, reject) => {
            const serialport$1 = new serialport.SerialPort({
                path: devicePath,
                baudRate: 19200,
                dataBits: 8,
                stopBits: 1,
                parity: 'none'
            }, (err) => {
                if (err) {
                    this.#emitEvent("error", {
                        message: `Device ${devicePath} serial port error`,
                        dataDump: err
                    });
                    this.#VEDirectDevicesData = {};
                    reject();
                }
            });
            serialport$1.on("open", () => {
                this.#emitEvent("device-connection-open", {
                    message: "VE.Direct device connected through serial port",
                    dataDump: devicePath
                });
            });
            serialport$1.on('error', (err) => {
                this.#emitEvent("device-connection-error", {
                    message: "VE.Direct device connection error through serial port",
                    dataDump: {
                        devicePath: devicePath,
                        errorDataDump: err
                    }
                });
            });
            this.#serialPorts.push(serialport$1);
            const delimiter = new serialport.DelimiterParser({
                delimiter: Buffer.from([0x0d, 0x0a], 'hex'),
                includeDelimiter: false
            });
            const VEDParser = new VEDirectParser();
            serialport$1.pipe(delimiter).pipe(VEDParser);
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

module.exports = VEDirectPnP;
