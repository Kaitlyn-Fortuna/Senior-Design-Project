# Senior Design Project

Real-time energy monitor: Vue.js dashboard + Node/Express API.

## Stack

| Layer     | Technology                                                           |
| ---       | ---                                                                  |
| Frontend  | Vue.js, Chart.js, Socket.IO client                                   |
| Backend   | Node.js, Express, Passport.js (JWT), Socket.IO, PostgreSQL           |

Development cloud database hosted at https://supabase.com/dashboard/project/rjthnnssesqanaoajosf

---

## Run locally

### 1. Install packages
```bash
npm run install:all
npm audit fix --force
```

### 2. Set up environment files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Fill in the Google authentication values in `backend/.env`.

### 3. Start the dashboard and API
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Demo login: `demo` / `demo123`

---

## Run the main program (Smart Power Meter)

All commands below are run from the repo root unless they `cd` first.

### 1. Set up the Pi

1. Turn on SPI and I2C: 
    ```bash
    sudo raspi-config # Interface Options → enable SPI and I2C
    ```
2. Reboot pi
    ```bash
    sudo reboot
    ```
3. Install packages
    ```bash
    npm run install:all
    npm audit fix --force
    ```

### 2. Set up the device configuration
```bash
cp backend/src/device-configuration.example.json backend/src/device-configuration.json
```

### 3. Run it
```bash
cd backend
node smartPowerMeter.js
```

Optional flags
```bash
--leds      # Cycles through each LED, then exits
--test      # ADC shorts its inputs internally, every channel should read ~0 V
--dc        # ADC measures an internal DC test signal, every channel should read ~+0.16 V
--raw       # Prints the raw voltage at each ADC pin instead of calculated values
--debug     # Prints the ADC registers at startup, plus raw frames and sample rate every second
```

Press **Ctrl+C** to stop. This turns off the LEDs and releases the GPIO pins.

### Reading the output

```
VS1 121.3 V   VS2 120.8 V   (4000 samples, ~0 missed)
       Irms (A)    P (W)    S (VA)     PF
  CT1     1.204    140.2     146.0  0.960
  ...
```
- **VS1 / VS2**: RMS line voltage on each voltage sensor.
- **Irms**: RMS current through the clamp.
- **P**: real power. **S**: apparent power. **PF**: power factor (P / S).
- **~N missed**: samples dropped during that interval. Should stay at or near 0.
