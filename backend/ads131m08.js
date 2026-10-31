// ADS131M08 -> Raspberry Pi over SPI, NodeJS
// npm i spi-device onoff i2c-bus
//
// Wiring (change the pin numbers to match your board):
//   SCLK -> GPIO11 (SPI0 SCLK)   DIN  -> GPIO10 (MOSI)
//   DOUT -> GPIO9  (MISO)        CS   -> GPIO8  (CE0)
//   DRDY -> GPIO25 (input)       SYNC/RESET -> GPIO24 (output, must idle HIGH)
//   CLKIN -> 8.192 MHz oscillator (REQUIRED: the chip has no internal clock)

import spi from 'spi-device';
import onoff from 'onoff';
import fs from 'node:fs';
import i2c from 'i2c-bus';
const { Gpio } = onoff;

const DRDY_PIN = 25, RESET_PIN = 24;
const SPI_HZ = 8_000_000;          // chip supports up to 25 MHz
const WORD = 3;                    // 24-bit words (default MODE.WLENGTH)
const NWORDS = 10;                 // status + 8 channels + CRC
const FRAME = WORD * NWORDS;       // 30 bytes per frame
const VREF = 1.2;

// Run `node ads131m08.js --test` to short every input inside the ADC (sanity check)
const TEST_MODE = process.argv.includes('--test');
// Add `--dc` to feed the internal positive DC test signal (~+0.16 V) into every channel
const DC_MODE = process.argv.includes('--dc');
// Add `--debug` to dump registers after init and print raw hex codes
const DEBUG = process.argv.includes('--debug');

// ADC channel -> board input (from schematic)
const CHANNELS = [
  { name: 'CT1', pin: 'AIN0' }, { name: 'CT2', pin: 'AIN1' },
  { name: 'CT3', pin: 'AIN2' }, { name: 'CT4', pin: 'AIN3' },
  { name: 'CT5', pin: 'AIN4' }, { name: 'CT6', pin: 'AIN5' },
  { name: 'VS1', pin: 'AIN6' }, { name: 'VS2', pin: 'AIN7' },
];

// Add `--raw` to print one raw sample per second instead of RMS/power
// (--test and --dc always use the raw view)
const RAW_VIEW = process.argv.includes('--raw') || TEST_MODE || DC_MODE;

// ---------- Measurement scaling (edit these) ----------
// Current: I_line = V_adc / R_BURDEN * CT_RATIO   (330 ohm resistors are filter, no effect)
const CT_RATIO = 2400;            // 2400:1 CT
const R_BURDEN = 10;              // ohms (R7 etc.)
// Turns of wire through each CT: [CT1, CT2, CT3, CT4, CT5, CT6]
// 1 = normal clamp, 10 = on the 10x side of a line splitter, any other number for N wraps
const TURNS = [1, 1, 1, 1, 1, 1];
// Voltage: V_line = V_adc * DIVIDER * VT_RATIO
const DIVIDER = 23;               // (10k + 12k + 1k) / 1k
const VT_RATIO = 120 / 10.4;      // line V / transformer secondary V: measure both and update
// Which voltage sensor each CT is paired with for power (0 = VS1, 1 = VS2)
const CT_VS = [0, 0, 0, 0, 0, 0];
// Per-channel calibration (multiply). Tune against a reference meter.
const CAL = [1, 1, 1, 1, 1, 1, 1, 1];
// ---------- Status LEDs (TPIC2810 on I2C bus 1) ----------
// LED Dn = TPIC output D(n-1) = bit (n-1). A 1 bit turns the LED on.
const LED_ADDR = 0x60;            // A0-A2 tied to GND
const LED_CMD_WRITE = 0x44;       // load shift register + latch to outputs
const LED_BIT = {                 // input -> bit (LED refdes in comment)
  VS1: 3,  // D4
  VS2: 2,  // D3
  CT1: 1,  // D2
  CT2: 0,  // D1
  CT3: 7,  // D8
  CT4: 6,  // D7
  CT5: 5,  // D6
  CT6: 4,  // D5
};
const V_ON = 20;                  // V rms: voltage present above this
const I_ON = 0.05;                // A rms: current flowing above this (actual appliance amps)
// Run `node ads131m08.js --leds` to light each LED in turn and check the mapping
const LED_TEST = process.argv.includes('--leds');
// -----------------------------------------------------
const NOMINAL_SPS = 4000;         // 8.192 MHz CLKIN, OSR 1024
const BLOCK = 4000;               // samples per report (~1 s = 60 cycles @ 60 Hz)
// -----------------------------------------------------

// Registers
const REG = { ID: 0x00, STATUS: 0x01, MODE: 0x02, CLOCK: 0x03, GAIN1: 0x04, GAIN2: 0x05, CFG: 0x06 };
// Commands (16-bit, MSB-aligned inside a 24-bit word)
const CMD = { NULL: 0x0000, RESET: 0x0011, STANDBY: 0x0022, WAKEUP: 0x0033 };
const RREG = (addr) => 0xA000 | (addr << 7);          // read 1 register
const WREG = (addr) => 0x6000 | (addr << 7);          // write 1 register

// Kernel 6.6+ offsets sysfs GPIO numbers (512 on Pi 4, 571 on Pi 5, etc.)
function gpioBase() {
  try {
    for (const d of fs.readdirSync('/sys/class/gpio')) {
      if (!d.startsWith('gpiochip')) continue;
      const label = fs.readFileSync(`/sys/class/gpio/${d}/label`, 'utf8').trim();
      if (/pinctrl-(bcm2|rp1)/.test(label))
        return Number(fs.readFileSync(`/sys/class/gpio/${d}/base`, 'utf8'));
    }
  } catch {}
  return 0;
}
const base = gpioBase();

const dev = spi.openSync(0, 0, { mode: spi.MODE1, maxSpeedHz: SPI_HZ }); // MODE1 = CPOL0, CPHA1
const resetPin = new Gpio(base + RESET_PIN, 'high');
const drdy = new Gpio(base + DRDY_PIN, 'in', 'falling');

// One full frame. `words` = 16-bit values placed MSB-first in each 24-bit slot.
function xfer(words = []) {
  const tx = Buffer.alloc(FRAME), rx = Buffer.alloc(FRAME);
  words.forEach((w, i) => { tx[i * WORD] = (w >> 8) & 0xff; tx[i * WORD + 1] = w & 0xff; });
  dev.transferSync([{ sendBuffer: tx, receiveBuffer: rx, byteLength: FRAME, speedHz: SPI_HZ }]);
  return rx;
}
const word16 = (rx, i) => (rx[i * WORD] << 8) | rx[i * WORD + 1];
function s24(rx, i) {
  let v = (rx[i * WORD] << 16) | (rx[i * WORD + 1] << 8) | rx[i * WORD + 2];
  return v & 0x800000 ? v - 0x1000000 : v;   // two's complement
}

// Responses are pipelined: the reply to frame N arrives in frame N+1.
function readReg(addr) {
  xfer([RREG(addr)]);
  return word16(xfer([CMD.NULL]), 0);
}
function writeReg(addr, val) {
  xfer([WREG(addr), val]);
  const ack = word16(xfer([CMD.NULL]), 0);
  if (ack !== (0x4000 | (addr << 7))) throw new Error(`WREG 0x${addr.toString(16)} not acked (got 0x${ack.toString(16)})`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Gain codes 0..7 = 1,2,4,...,128
const GAINS = [1, 1, 1, 1, 1, 1, 1, 1]; // per channel, edit as needed
const gainCode = (g) => Math.log2(g);

async function init() {
  // 1. Hardware reset: SYNC/RESET low > 2048 CLKIN cycles (~250 us), then high
  resetPin.writeSync(0); await sleep(1);
  resetPin.writeSync(1); await sleep(5);

  // 2. Confirm SPI works: ID upper byte should be 0x28 for the M08
  const id = readReg(REG.ID);
  if ((id >> 8) !== 0x28) throw new Error(`Bad ID 0x${id.toString(16)}: check wiring, SPI mode, CLKIN`);

  // 3. Clear the RESET flag (MODE default 0x0510 -> 0x0110) so a later
  //    unexpected reset is detectable in the status word
  writeReg(REG.MODE, 0x0110);

  // 4. Gains (ch0-3 in GAIN1, ch4-7 in GAIN2, 4 bits per channel)
  const pack = (a) => a.reduce((acc, g, i) => acc | (gainCode(g) << (4 * i)), 0);
  writeReg(REG.GAIN1, pack(GAINS.slice(0, 4)));
  writeReg(REG.GAIN2, pack(GAINS.slice(4, 8)));

  // 5. Clock: all channels on, XTAL_DIS=1 (bit 7: we drive CLKIN from an external
  //    oscillator, so the crystal driver is turned off), internal ref, OSR 1024
  //    (4 kSPS w/ 8.192 MHz), high-res. Power-on default is 0xFF0E (crystal driver on).
  //    OSR bits [4:2]: 0=128 1=256 2=512 3=1024 4=2048 5=4096 6=8192 7=16256
  writeReg(REG.CLOCK, 0xFF8E);

  // 6. Input mux per channel (CHn_CFG = 0x09 + 5n, MUX bits [1:0]):
  //    0 = normal inputs, 1 = inputs shorted internally (should read ~0 V)
  const mux = TEST_MODE ? 0x0001 : DC_MODE ? 0x0002 : 0x0000;
  for (let ch = 0; ch < 8; ch++) writeReg(0x09 + 5 * ch, mux);

  if (DEBUG) {
    const names = ['ID', 'STATUS', 'MODE', 'CLOCK', 'GAIN1', 'GAIN2', 'CFG', 'THR_MSB', 'THR_LSB'];
    for (let a = 0; a < names.length; a++)
      console.log(`  ${names[a].padEnd(8)} 0x${a.toString(16).padStart(2, '0')} = 0x${readReg(a).toString(16).padStart(4, '0')}`);
    for (let ch = 0; ch < 8; ch++)
      console.log(`  CH${ch}_CFG  0x${(0x09 + 5 * ch).toString(16).padStart(2, '0')} = 0x${readReg(0x09 + 5 * ch).toString(16).padStart(4, '0')}`);
  }

  console.log(`ADS131M08 ready, ID=0x${id.toString(16)}` +
    (TEST_MODE ? '  [TEST MODE: inputs shorted internally, expect ~0 V]' :
     DC_MODE ? '  [DC MODE: internal +DC test signal, expect ~+0.16 V on all channels]' : ''));
}

function toVolts(code, ch) { return (code * VREF) / (GAINS[ch] * 0x800000); }

let drdyCount = 0;

// ---- LEDs ----
let bus = null;
try { bus = i2c.openSync(1); } catch (e) { console.warn(`I2C bus 1 unavailable, LEDs off: ${e.message}`); }
let lastMask = -1;
function setLeds(mask) {
  if (!bus || mask === lastMask) return;
  try { bus.writeByteSync(LED_ADDR, LED_CMD_WRITE, mask & 0xff); lastMask = mask; }
  catch (e) { console.warn(`LED write failed (is the TPIC2810 at 0x${LED_ADDR.toString(16)}?): ${e.message}`); }
}
async function ledTest() {
  const names = Object.keys(LED_BIT);
  console.log('LED test: all on');
  setLeds(0xff); await sleep(1500);
  for (const name of names) {
    console.log(`  ${name} -> D${LED_BIT[name] + 1}`);
    setLeds(1 << LED_BIT[name]); await sleep(1000);
  }
  setLeds(0); console.log('LED test done');
}

async function main() {
  if (LED_TEST) { await ledTest(); bus?.closeSync(); process.exit(0); }
  await init();

  drdy.watch((err) => {
    if (err) return console.error(err);
    const rx = xfer([CMD.NULL]);
    const status = word16(rx, 0);
    if (status & 0x0400) console.warn('ADC reset unexpectedly — re-run init()');
    drdyCount++;
    if (DEBUG && n % 4000 === 0) {
      const hex = [];
      for (let w = 0; w < NWORDS; w++) hex.push(rx.subarray(w * WORD, w * WORD + WORD).toString('hex'));
      console.log(`  raw: status=${hex[0]} ch=[${hex.slice(1, 9).join(' ')}] crc=${hex[9]}`);
    }
    const volts = [];
    for (let ch = 0; ch < 8; ch++) volts.push(toVolts(s24(rx, ch + 1), ch));
    onSample(volts);
  });

  if (DEBUG) setInterval(() => {
    console.log(`  DRDY rate: ${drdyCount} samples/s (expect ~4000 with 8.192 MHz CLKIN)`);
    drdyCount = 0;
  }, 1000);

  process.on('SIGINT', () => {
    setLeds(0);
    drdy.unexport(); resetPin.unexport(); dev.closeSync(); bus?.closeSync();
    process.exit();
  });
}

const COL = 12;
const header = () => {
  console.log(CHANNELS.map((c) => c.name.padStart(COL)).join(''));
  console.log(CHANNELS.map((c) => c.pin.padStart(COL)).join(''));
  console.log('-'.repeat(COL * CHANNELS.length));
};
let n = 0, lines = 0;

// Running sums for one block
const sum = new Float64Array(8), sumSq = new Float64Array(8), sumVI = new Float64Array(12);
let count = 0, blockStart = process.hrtime.bigint();

const iScale = (ch) => (CT_RATIO / R_BURDEN / TURNS[ch]) * CAL[ch];
const vScale = (ch) => DIVIDER * VT_RATIO * CAL[ch];

function onSample(v) {
  n++;
  if (RAW_VIEW) {
    if (n % 4000 !== 0) return;                 // print ~1 line/sec at 4 kSPS
    if (lines++ % 20 === 0) header();
    console.log(v.map((x) => (x.toFixed(5) + ' V').padStart(COL)).join(''));
    return;
  }

  // Scale to real units
  const i = [], vs = [v[6] * vScale(6), v[7] * vScale(7)];
  for (let ch = 0; ch < 6; ch++) i.push(v[ch] * iScale(ch));
  const x = [...i, ...vs];
  for (let k = 0; k < 8; k++) { sum[k] += x[k]; sumSq[k] += x[k] * x[k]; }
  for (let ch = 0; ch < 6; ch++) sumVI[ch] += vs[CT_VS[ch]] * i[ch];
  if (++count < BLOCK) return;

  // ---- Report: RMS with DC offset removed, real power = mean(v*i) ----
  const now = process.hrtime.bigint();
  const secs = Number(now - blockStart) / 1e9;
  const missed = Math.max(0, Math.round(secs * NOMINAL_SPS) - count);
  const mean = (k) => sum[k] / count;
  const rms = (k) => Math.sqrt(Math.max(0, sumSq[k] / count - mean(k) ** 2));

  const vRms = [rms(6), rms(7)];
  console.log(`\nVS1 ${vRms[0].toFixed(1)} V   VS2 ${vRms[1].toFixed(1)} V   ` +
    `(${count} samples, ~${missed} missed)`);
  console.log('       Irms (A)    P (W)    S (VA)     PF');
  let mask = 0;
  if (vRms[0] > V_ON) mask |= 1 << LED_BIT.VS1;
  if (vRms[1] > V_ON) mask |= 1 << LED_BIT.VS2;
  for (let ch = 0; ch < 6; ch++) {
    const vk = 6 + CT_VS[ch];
    const iRms = rms(ch);
    if (iRms > I_ON) mask |= 1 << LED_BIT[`CT${ch + 1}`];
    const p = sumVI[ch] / count - mean(vk) * mean(ch);
    const sVA = vRms[CT_VS[ch]] * iRms;
    const pf = sVA > 1 ? p / sVA : 0;
    console.log(`  CT${ch + 1}  ${iRms.toFixed(3).padStart(8)} ${p.toFixed(1).padStart(8)} ` +
      `${sVA.toFixed(1).padStart(9)} ${pf.toFixed(3).padStart(6)}`);
  }

  setLeds(mask);

  sum.fill(0); sumSq.fill(0); sumVI.fill(0); count = 0; blockStart = now;
}

main().catch((e) => { console.error(e); process.exit(1); });
