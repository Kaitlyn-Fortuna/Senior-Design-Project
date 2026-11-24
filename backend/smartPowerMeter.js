// ADS131M08 -> Raspberry Pi over SPI, NodeJS
// TPIC2810 -> Raspberry Pi over I2C, NodeJS
// npm i spi-device onoff i2c-bus

import spi from "spi-device";
import onoff from "onoff";
import fs from "node:fs";
import i2c from "i2c-bus";
import os from "node:os";
const { Gpio } = onoff;

import { insertRecord } from "./src/database/dbAccessMethods.js";
import {
  loadDeviceConfig,
  watchDeviceConfig,
  ampsPerVolt,
  voltsPerVolt,
  channelGains,
  CURRENT_KEYS,
  VOLTAGE_KEYS,
  CONFIG_PATH,
} from "./src/deviceConfig.js";

// ---------------------------------------------------------------------------
// Hardware constants
// ---------------------------------------------------------------------------

const DATA_READY_PIN = 25; // ADC pulls this low when a new sample is ready
const RESET_PIN = 24; // Driving this low resets the ADC
const SPI_CLOCK_HZ = 8_000_000; // SPI clock speed (max 25MHz) (1 bit per cycle)
const BYTES_PER_WORD = 3; // ADC sends 24-bit words
const WORDS_PER_FRAME = 10; // status word + 8 channel words + CRC word
const BYTES_PER_FRAME = BYTES_PER_WORD * WORDS_PER_FRAME; // 30 bytes per frame
const ADC_REFERENCE_VOLTAGE = 1.2; // Internal reference voltage

// ADC channel layout: channels 0-5 are current transformers, 6-7 are voltage sensors
const NUM_ADC_CHANNELS = 8;
const NUM_CURRENT_CHANNELS = 6;
const NUM_VOLTAGE_SENSORS = 2;
const FIRST_VOLTAGE_CHANNEL = 6; // ADC channel index of VS1

// ---------------------------------------------------------------------------
// Command-line flags
// ---------------------------------------------------------------------------

const TEST_MODE = process.argv.includes("--test"); // Short internal leads to (~+0.00 V)
const DC_MODE = process.argv.includes("--dc"); // DC test signal (~+0.16 V)
const DEBUG = process.argv.includes("--debug"); // Prints raw registers
const RAW_VIEW = process.argv.includes("--raw") || TEST_MODE || DC_MODE; // Prints raw ADC voltages
const LED_TEST = process.argv.includes("--leds"); // Tests LEDs

// ---------------------------------------------------------------------------
// ADC Channels
// ---------------------------------------------------------------------------

const CHANNELS = [
  { name: "CT1", pin: "AIN0" },
  { name: "CT2", pin: "AIN1" },
  { name: "CT3", pin: "AIN2" },
  { name: "CT4", pin: "AIN3" },
  { name: "CT5", pin: "AIN4" },
  { name: "CT6", pin: "AIN5" },
  { name: "VS1", pin: "AIN6" },
  { name: "VS2", pin: "AIN7" },
];

// ---------------------------------------------------------------------------
// Settings derived from the device config file
// ---------------------------------------------------------------------------

let deviceConfig = loadDeviceConfig();
let channelScaleFactors = []; // ADC volts
let voltageSensorForCurrentChannel = []; // Which voltage sensor each CT is paired with (0 = VS1, 1 = VS2)
let adcGains = []; // ADC gain per channel (c0-c5, v0, v1)
let ledMinVoltage = 0; // Minimum voltage to light a voltage LED
let ledMinCurrent = 0; // Minimum current to light a current LED
let dbMinVoltage = 0; // Voltages below this are saved as 0
let dbMinCurrent = 0; // Currents below this are saved as 0
let dbMinPower = 0; // Real powers below this are saved as 0
let dbInsertIntervalSeconds = 1; // How often to write a row to the database
let pricePerKwh = 0; // Electricity price saved with each row ($/kWh)
applySettingsFromConfig(deviceConfig);

function applySettingsFromConfig(config) {
  const enabledMultiplier = (inputKey) => (config.inputs[inputKey].enabled ? 1 : 0);
  channelScaleFactors = [
    ...CURRENT_KEYS.map((key) => ampsPerVolt(config, key) * enabledMultiplier(key)),
    ...VOLTAGE_KEYS.map((key) => voltsPerVolt(config, key) * enabledMultiplier(key)),
  ];
  voltageSensorForCurrentChannel = CURRENT_KEYS.map((key) =>
    VOLTAGE_KEYS.indexOf(config.inputs[key].voltage_sensor),
  );
  adcGains = channelGains(config);
  ledMinVoltage = config.leds.min_voltage;
  ledMinCurrent = config.leds.min_current;
  dbMinVoltage = config.database.min_voltage;
  dbMinCurrent = config.database.min_current;
  dbMinPower = config.database.min_power;
  dbInsertIntervalSeconds = config.database.insert_seconds;
  pricePerKwh = config.pricing.price_per_kwh;
}

// ---------------------------------------------------------------------------
// LED driver settings
// ---------------------------------------------------------------------------

const LED_DRIVER_I2C_ADDRESS = 0x60; // A0-A2 tied to GND
const LED_DRIVER_WRITE_COMMAND = 0x44; // load shift register + latch to outputs
const LED_BIT_FOR_INPUT = {
  VS1: 3, // D4
  VS2: 2, // D3
  CT1: 1, // D2
  CT2: 0, // D1
  CT3: 7, // D8
  CT4: 6, // D7
  CT5: 5, // D6
  CT6: 4, // D5
};

// ---------------------------------------------------------------------------
// ADC settings
// ---------------------------------------------------------------------------

const ADC_CLOCK_HZ = 8_192_000; // External oscillator clock speed
const OVERSAMPLING_RATIO = deviceConfig.adc.oversampling_ratio; // (restart to change)
const OVERSAMPLING_RATIO_CODES = {
  128: 0,
  256: 1,
  512: 2,
  1024: 3,
  2048: 4,
  4096: 5,
  8192: 6,
  16256: 7,
};
const OVERSAMPLING_RATIO_CODE = OVERSAMPLING_RATIO_CODES[OVERSAMPLING_RATIO];
const NOMINAL_SAMPLES_PER_SECOND = ADC_CLOCK_HZ / 2 / OVERSAMPLING_RATIO; // Per channel
const REPORT_SECONDS = deviceConfig.adc.report_seconds; // (restart to change) How often to compute and print (multiple of 1/60s [0.1, 0.2, 0.5, 1])
const SAMPLES_PER_REPORT = Math.round(NOMINAL_SAMPLES_PER_SECOND * REPORT_SECONDS);
const SAMPLES_PER_SECOND = Math.round(NOMINAL_SAMPLES_PER_SECOND); // Used for 1-line-per-second debug prints

if (OVERSAMPLING_RATIO_CODE === undefined) {
  throw new Error(
    `OSR must be one of ${Object.keys(OVERSAMPLING_RATIO_CODES).join(", ")} (got ${OVERSAMPLING_RATIO})`,
  );
}

// ---------------------------------------------------------------------------
// ADC registers and commands
// ---------------------------------------------------------------------------

const REGISTER = {
  ID: 0x00,
  STATUS: 0x01,
  MODE: 0x02,
  CLOCK: 0x03,
  GAIN1: 0x04,
  GAIN2: 0x05,
  CFG: 0x06,
};

const COMMAND = { NULL: 0x0000, RESET: 0x0011, STANDBY: 0x0022, WAKEUP: 0x0033 };
const readRegisterCommand = (address) => 0xa000 | (address << 7); // read 1 register
const writeRegisterCommand = (address) => 0x6000 | (address << 7); // write 1 register

// ---------------------------------------------------------------------------
// GPIO / SPI setup
// ---------------------------------------------------------------------------

function findGpioBaseNumber() {
  try {
    for (const chipDirName of fs.readdirSync("/sys/class/gpio")) {
      if (!chipDirName.startsWith("gpiochip")) continue;
      const chipLabel = fs
        .readFileSync(`/sys/class/gpio/${chipDirName}/label`, "utf8")
        .trim();
      if (/pinctrl-(bcm2|rp1)/.test(chipLabel))
        return Number(fs.readFileSync(`/sys/class/gpio/${chipDirName}/base`, "utf8"));
    }
  } catch {}
  return 0;
}

try {
  checkOS();
} catch (e) {
  console.error(`Error checking OS: ${e.message}`);
  process.exit(1);
}

const gpioBaseNumber = findGpioBaseNumber();

const adcSpiDevice = spi.openSync(0, 0, { mode: spi.MODE1, maxSpeedHz: SPI_CLOCK_HZ }); // MODE1 = CPOL0, CPHA1
const resetPin = new Gpio(gpioBaseNumber + RESET_PIN, "high");
const dataReadyPin = new Gpio(gpioBaseNumber + DATA_READY_PIN, "in", "falling");

function spiTransfer(commandWords = []) {
  const sendBuffer = Buffer.alloc(BYTES_PER_FRAME);
  const receiveBuffer = Buffer.alloc(BYTES_PER_FRAME);
  commandWords.forEach((commandWord, wordIndex) => {
    sendBuffer[wordIndex * BYTES_PER_WORD] = (commandWord >> 8) & 0xff;
    sendBuffer[wordIndex * BYTES_PER_WORD + 1] = commandWord & 0xff;
  });
  adcSpiDevice.transferSync([
    { sendBuffer, receiveBuffer, byteLength: BYTES_PER_FRAME, speedHz: SPI_CLOCK_HZ },
  ]);
  return receiveBuffer;
}

const readUnsigned16BitWord = (buffer, wordIndex) =>
  (buffer[wordIndex * BYTES_PER_WORD] << 8) | buffer[wordIndex * BYTES_PER_WORD + 1];

function readSigned24BitWord(buffer, wordIndex) {
  const start = wordIndex * BYTES_PER_WORD;
  const value = (buffer[start] << 16) | (buffer[start + 1] << 8) | buffer[start + 2];
  return value & 0x800000 ? value - 0x1000000 : value;
}

function readRegister(address) {
  spiTransfer([readRegisterCommand(address)]);
  return readUnsigned16BitWord(spiTransfer([COMMAND.NULL]), 0);
}

function writeRegister(address, value) {
  spiTransfer([writeRegisterCommand(address), value]);
  const acknowledgement = readUnsigned16BitWord(spiTransfer([COMMAND.NULL]), 0);
  if (acknowledgement !== (0x4000 | (address << 7)))
    throw new Error(
      `WREG 0x${address.toString(16)} not acked (got 0x${acknowledgement.toString(16)})`,
    );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gainToRegisterCode = (gain) => Math.log2(gain);

// Each GAIN register holds four 4-bit gain codes (one per channel)
function writeGainsToAdc() {
  const packGainCodes = (gains) =>
    gains.reduce((packed, gain, i) => packed | (gainToRegisterCode(gain) << (4 * i)), 0);
  writeRegister(REGISTER.GAIN1, packGainCodes(adcGains.slice(0, 4)));
  writeRegister(REGISTER.GAIN2, packGainCodes(adcGains.slice(4, 8)));
}

function checkOS() {
  const platform = os.platform();
  if (platform !== "linux") {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  const arch = os.arch();
  if (arch !== "arm" && arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${arch}`);
  }
  return true;
}

async function initializeAdc() {
  // 1. Hardware reset
  resetPin.writeSync(0);
  await sleep(1);
  resetPin.writeSync(1);
  await sleep(5);

  // 2. Confirm SPI
  const chipId = readRegister(REGISTER.ID);
  if (chipId >> 8 !== 0x28)
    throw new Error(
      `Bad ID 0x${chipId.toString(16)}: check wiring, SPI mode, CLKIN`,
    );

  // 3. Clear the RESET flag
  writeRegister(REGISTER.MODE, 0x0110);

  // 4. Set gains
  writeGainsToAdc();

  // 5. Clock register
  writeRegister(REGISTER.CLOCK, 0xff82 | (OVERSAMPLING_RATIO_CODE << 2));

  // 6. Input mux per channel
  const inputMux = TEST_MODE ? 0x0001 : DC_MODE ? 0x0002 : 0x0000;
  for (let channel = 0; channel < NUM_ADC_CHANNELS; channel++)
    writeRegister(0x09 + 5 * channel, inputMux);

  if (DEBUG) {
    const registerNames = [
      "ID",
      "STATUS",
      "MODE",
      "CLOCK",
      "GAIN1",
      "GAIN2",
      "CFG",
      "THR_MSB",
      "THR_LSB",
    ];
    for (let address = 0; address < registerNames.length; address++)
      console.log(
        `  ${registerNames[address].padEnd(8)} 0x${address.toString(16).padStart(2, "0")} = 0x${readRegister(address).toString(16).padStart(4, "0")}`,
      );
    for (let channel = 0; channel < NUM_ADC_CHANNELS; channel++)
      console.log(
        `  CH${channel}_CFG  0x${(0x09 + 5 * channel).toString(16).padStart(2, "0")} = 0x${readRegister(
          0x09 + 5 * channel,
        )
          .toString(16)
          .padStart(4, "0")}`,
      );
  }

  console.log(
    `ADS131M08 ready, ID=0x${chipId.toString(16)}` +
      (TEST_MODE
        ? "  [TEST MODE: inputs shorted internally, expect ~0 V]"
        : DC_MODE
          ? "  [DC MODE: internal +DC test signal, expect ~+0.16 V on all channels]"
          : ""),
  );
}

// Convert a raw signed ADC reading to the voltage at the ADC input pin
function adcCodeToVolts(adcCode, channel) {
  return (adcCode * ADC_REFERENCE_VOLTAGE) / (adcGains[channel] * 0x800000);
}

let dataReadyCountThisSecond = 0;

// ---------------------------------------------------------------------------
// LEDs
// ---------------------------------------------------------------------------

let i2cBus = null;
try {
  i2cBus = i2c.openSync(1);
} catch (e) {
  console.warn(`I2C bus 1 unavailable, LEDs off: ${e.message}`);
}

let lastLedMask = -1;
function setLeds(ledMask) {
  if (!i2cBus || ledMask === lastLedMask) return;
  try {
    i2cBus.writeByteSync(LED_DRIVER_I2C_ADDRESS, LED_DRIVER_WRITE_COMMAND, ledMask & 0xff);
    lastLedMask = ledMask;
  } catch (e) {
    console.warn(
      `LED write failed (is the TPIC2810 at 0x${LED_DRIVER_I2C_ADDRESS.toString(16)}?): ${e.message}`,
    );
  }
}

async function ledTest() {
  const inputNames = Object.keys(LED_BIT_FOR_INPUT);
  console.log("LED test: all on");
  setLeds(0xff);
  await sleep(1500);
  for (const inputName of inputNames) {
    console.log(`  ${inputName} -> D${LED_BIT_FOR_INPUT[inputName] + 1}`);
    setLeds(1 << LED_BIT_FOR_INPUT[inputName]);
    await sleep(1000);
  }
  setLeds(0);
  console.log("LED test done");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (LED_TEST) {
    await ledTest();
    i2cBus?.closeSync();
    process.exit(0);
  }

  await initializeAdc();

  // Runs every time the ADC has a new sample ready on all 8 channels
  dataReadyPin.watch((err) => {
    if (err) return console.error(err);
    const frame = spiTransfer([COMMAND.NULL]);
    const statusWord = readUnsigned16BitWord(frame, 0);
    if (statusWord & 0x0400) console.warn("ADC reset unexpectedly — re-run initializeAdc()");
    dataReadyCountThisSecond++;
    if (DEBUG && totalSampleCount % SAMPLES_PER_SECOND === 0) {
      const hexWords = [];
      for (let w = 0; w < WORDS_PER_FRAME; w++)
        hexWords.push(frame.subarray(w * BYTES_PER_WORD, (w + 1) * BYTES_PER_WORD).toString("hex"));
      console.log(
        `  raw: status=${hexWords[0]} ch=[${hexWords.slice(1, 9).join(" ")}] crc=${hexWords[9]}`,
      );
    }
    // Word 0 is status, words 1-8 are the channels
    const adcInputVolts = [];
    for (let channel = 0; channel < NUM_ADC_CHANNELS; channel++)
      adcInputVolts.push(adcCodeToVolts(readSigned24BitWord(frame, channel + 1), channel));
    onSample(adcInputVolts);
  });

  watchDeviceConfig((newConfig) => {
    const gainsChanged = channelGains(newConfig).some((gain, i) => gain !== adcGains[i]);
    const needsRestart =
      newConfig.adc.oversampling_ratio !== deviceConfig.adc.oversampling_ratio ||
      newConfig.adc.report_seconds !== deviceConfig.adc.report_seconds;
    deviceConfig = newConfig;
    applySettingsFromConfig(deviceConfig);
    if (gainsChanged) {
      try {
        writeGainsToAdc();
      } catch (e) {
        console.error(`Could not update ADC gains: ${e.message}`);
      }
    }
    resetReportBlock();
    resetDbInterval();
    console.log(
      `Settings reloaded from ${CONFIG_PATH}` +
        (gainsChanged ? " (ADC gains updated)" : "") +
        (needsRestart ? " (restart to apply oversampling_ratio / report_seconds)" : ""),
    );
  });

  if (DEBUG)
    setInterval(() => {
      console.log(
        `  DRDY rate: ${dataReadyCountThisSecond} samples/s (expect ~${SAMPLES_PER_SECOND} at OSR ${OVERSAMPLING_RATIO})`,
      );
      dataReadyCountThisSecond = 0;
    }, 1000);

  process.on("SIGINT", () => {
    setLeds(0);
    dataReadyPin.unexport();
    resetPin.unexport();
    adcSpiDevice.closeSync();
    i2cBus?.closeSync();
    process.exit();
  });
}

// ---------------------------------------------------------------------------
// Raw view printing
// ---------------------------------------------------------------------------

const COLUMN_WIDTH = 12;
const printRawHeader = () => {
  console.log(CHANNELS.map((c) => c.name.padStart(COLUMN_WIDTH)).join(""));
  console.log(CHANNELS.map((c) => c.pin.padStart(COLUMN_WIDTH)).join(""));
  console.log("-".repeat(COLUMN_WIDTH * CHANNELS.length));
};
let totalSampleCount = 0;
let rawLinesPrinted = 0;

// ---------------------------------------------------------------------------
// Running sums
// ---------------------------------------------------------------------------

const sumOfValues = new Float64Array(NUM_ADC_CHANNELS); // Σ x        (for the DC offset / mean)
const sumOfSquares = new Float64Array(NUM_ADC_CHANNELS); // Σ x²       (for RMS)
const sumOfVoltageTimesCurrent = new Float64Array(NUM_CURRENT_CHANNELS); // Σ v·i (for real power)
let samplesInBlock = 0;
let blockStartTime = process.hrtime.bigint();

function resetReportBlock() {
  sumOfValues.fill(0);
  sumOfSquares.fill(0);
  sumOfVoltageTimesCurrent.fill(0);
  samplesInBlock = 0;
  blockStartTime = process.hrtime.bigint();
}

// ---------------------------------------------------------------------------
// Database interval
// ---------------------------------------------------------------------------

const dbIntervalTotals = {
  reportCount: 0,
  rmsCurrent: new Array(NUM_CURRENT_CHANNELS).fill(0), // amps
  rmsVoltage: new Array(NUM_CURRENT_CHANNELS).fill(0), // volts of the sensor paired with each CT
  realPower: new Array(NUM_CURRENT_CHANNELS).fill(0), // watts
  apparentPower: new Array(NUM_CURRENT_CHANNELS).fill(0), // volt-amps
};
let lastDbInsertTime = Date.now();

function resetDbInterval() {
  dbIntervalTotals.reportCount = 0;
  dbIntervalTotals.rmsCurrent.fill(0);
  dbIntervalTotals.rmsVoltage.fill(0);
  dbIntervalTotals.realPower.fill(0);
  dbIntervalTotals.apparentPower.fill(0);
}

function saveToDb() {
  const reportCount = dbIntervalTotals.reportCount;
  if (reportCount === 0) return;
  const average = (totals) => totals.map((total) => total / reportCount);
  const zeroIfBelow = (value, minimum) => (Math.abs(value) < minimum ? 0 : value);

  const currents = average(dbIntervalTotals.rmsCurrent).map((amps) => zeroIfBelow(amps, dbMinCurrent));
  const voltages = average(dbIntervalTotals.rmsVoltage).map((volts) => zeroIfBelow(volts, dbMinVoltage));
  const averageRealPowers = average(dbIntervalTotals.realPower);
  const averageApparentPowers = average(dbIntervalTotals.apparentPower);

  const realPowers = [];
  const apparentPowers = [];
  const powerFactors = [];
  for (let ct = 0; ct < NUM_CURRENT_CHANNELS; ct++) {
    const hasSignal = currents[ct] !== 0 && voltages[ct] !== 0;
    const realPower = hasSignal ? zeroIfBelow(averageRealPowers[ct], dbMinPower) : 0;
    const apparentPower = hasSignal ? averageApparentPowers[ct] : 0;
    // Power factor from the averaged powers (more accurate than averaging per-block PFs)
    const powerFactor = apparentPower > 0 ? realPower / apparentPower : 0;
    realPowers.push(realPower);
    apparentPowers.push(apparentPower);
    powerFactors.push(powerFactor);
  }

  insertRecord(currents, voltages, apparentPowers, realPowers, powerFactors, pricePerKwh).catch((e) =>
    console.error("DB insert failed:", e.message),
  );
  resetDbInterval();
}

// ---------------------------------------------------------------------------
// Per-sample processing
// ---------------------------------------------------------------------------

// Called once per ADC sample with the voltage at each of the 8 ADC input pins
function onSample(adcInputVolts) {
  totalSampleCount++;
  if (RAW_VIEW) {
    if (totalSampleCount % SAMPLES_PER_SECOND !== 0) return;
    if (rawLinesPrinted++ % 20 === 0) printRawHeader();
    console.log(adcInputVolts.map((volts) => (volts.toFixed(5) + " V").padStart(COLUMN_WIDTH)).join(""));
    return;
  }

  const scaledValues = adcInputVolts.map((volts, channel) => volts * channelScaleFactors[channel]);
  const instantCurrents = scaledValues.slice(0, NUM_CURRENT_CHANNELS);
  const instantLineVoltages = scaledValues.slice(FIRST_VOLTAGE_CHANNEL);

  for (let channel = 0; channel < NUM_ADC_CHANNELS; channel++) {
    sumOfValues[channel] += scaledValues[channel];
    sumOfSquares[channel] += scaledValues[channel] * scaledValues[channel];
  }
  for (let ct = 0; ct < NUM_CURRENT_CHANNELS; ct++) {
    const pairedVoltage = instantLineVoltages[voltageSensorForCurrentChannel[ct]];
    sumOfVoltageTimesCurrent[ct] += pairedVoltage * instantCurrents[ct];
  }

  if (++samplesInBlock < SAMPLES_PER_REPORT) return;
  finishReportBlock();
}

function finishReportBlock() {
  const now = process.hrtime.bigint();
  const blockSeconds = Number(now - blockStartTime) / 1e9;
  const missedSamples = Math.max(0, Math.round(blockSeconds * NOMINAL_SAMPLES_PER_SECOND) - samplesInBlock);

  const blockMean = (channel) => sumOfValues[channel] / samplesInBlock;
  // RMS with the DC offset removed (AC RMS)
  const blockRms = (channel) =>
    Math.sqrt(Math.max(0, sumOfSquares[channel] / samplesInBlock - blockMean(channel) ** 2));

  const sensorRmsVoltages = [];
  for (let sensor = 0; sensor < NUM_VOLTAGE_SENSORS; sensor++)
    sensorRmsVoltages.push(blockRms(FIRST_VOLTAGE_CHANNEL + sensor));

  console.log(
    `\nVS1 ${sensorRmsVoltages[0].toFixed(1)} V   VS2 ${sensorRmsVoltages[1].toFixed(1)} V   ` +
      `(${samplesInBlock} samples, ~${missedSamples} missed)`,
  );
  console.log("       Irms (A)    P (W)    S (VA)     PF");

  let ledMask = 0;
  if (sensorRmsVoltages[0] > ledMinVoltage) ledMask |= 1 << LED_BIT_FOR_INPUT.VS1;
  if (sensorRmsVoltages[1] > ledMinVoltage) ledMask |= 1 << LED_BIT_FOR_INPUT.VS2;

  for (let ct = 0; ct < NUM_CURRENT_CHANNELS; ct++) {
    const sensorIndex = voltageSensorForCurrentChannel[ct];
    const voltageChannel = FIRST_VOLTAGE_CHANNEL + sensorIndex;
    const rmsVoltage = sensorRmsVoltages[sensorIndex];
    const rmsCurrent = blockRms(ct);
    if (rmsCurrent > ledMinCurrent) ledMask |= 1 << LED_BIT_FOR_INPUT[`CT${ct + 1}`];

    // Real power = mean(v·i) with DC offsets removed
    const realPower = sumOfVoltageTimesCurrent[ct] / samplesInBlock - blockMean(voltageChannel) * blockMean(ct);
    const apparentPower = rmsVoltage * rmsCurrent;
    const powerFactor = apparentPower > 1 ? realPower / apparentPower : 0;

    dbIntervalTotals.rmsCurrent[ct] += rmsCurrent;
    dbIntervalTotals.rmsVoltage[ct] += rmsVoltage;
    dbIntervalTotals.realPower[ct] += realPower;
    dbIntervalTotals.apparentPower[ct] += apparentPower;

    console.log(
      `  CT${ct + 1}  ${rmsCurrent.toFixed(3).padStart(8)} ${realPower.toFixed(1).padStart(8)} ` +
        `${apparentPower.toFixed(1).padStart(9)} ${powerFactor.toFixed(3).padStart(6)}`,
    );
  }

  setLeds(ledMask);

  dbIntervalTotals.reportCount++;
  if (Date.now() - lastDbInsertTime >= dbInsertIntervalSeconds * 1000) {
    lastDbInsertTime = Date.now();
    saveToDb();
  }

  sumOfValues.fill(0);
  sumOfSquares.fill(0);
  sumOfVoltageTimesCurrent.fill(0);
  samplesInBlock = 0;
  blockStartTime = now;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
