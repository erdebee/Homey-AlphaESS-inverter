'use strict';

import ModbusBaseDevice from '../baseModbusDevice';
import { powerToBatteryState } from '../../utils/batteryState';
import { formatBit } from '../../utils/formatBit';
import { ModbusResult } from '../../modbus/reader';
import config from './driver.compose.json';

const REG_DISPATCH_ENABLED = '0x880';
const REG_DISPATCH_MODE = '0x885';
const REG_DISPATCH_SOC = '0x886';
const SOC_FACTOR = 0.4;

class BatteryDevice extends ModbusBaseDevice {

  async onInit() {
    await this.checkCapabilites(config.capabilities);
    await super.onInit();

    this.registerCapabilityListener('dispatch_enabled', async (val: boolean) => {
      this.log('Set dispatch_enabled to', val);
      await this.emitter?.write(REG_DISPATCH_ENABLED, val ? 1 : 0);
    });

    this.registerCapabilityListener('dispatch_mode', async (val: string) => {
      this.log('Set dispatch_mode to', val);
      await this.emitter?.write(REG_DISPATCH_MODE, parseInt(val, 10));
    });

    this.registerCapabilityListener('dispatch_soc', async (val: number) => {
      this.log('Set dispatch_soc to', val);
      await this.emitter?.write(REG_DISPATCH_SOC, Math.round(val / SOC_FACTOR));
    });
  }

  async setCapabilities(data: ModbusResult) {
    await Promise.all([
      this.setCapabilityValue('measure_battery', data['0x102'].value),
      this.setCapabilityValue('measure_power', data['0x126'].value),

      this.setCapabilityValue('battery_charging_state', powerToBatteryState(data['0x126'].value as number)),

      this.setCapabilityValue('alarm_battery', data['0x11C'].value !== '00000000000000000000000000000000' || data['0x11E'].value !== '00000000000000000000000000000000'),
      this.setCapabilityValue('alpha_fault_text.warning', formatBit(data['0x11C'].value_string)),
      this.setCapabilityValue('alpha_fault_text.fault', formatBit(data['0x11E'].value_string)),

      this.setCapabilityValue('meter_power.charged', data['0x120'].value),
      this.setCapabilityValue('meter_power.discharged', data['0x122'].value),
      this.setCapabilityValue('meter_power.grid', data['0x124'].value),

      this.setCapabilityValue('dispatch_enabled', data[REG_DISPATCH_ENABLED]?.value === 1),
      this.setCapabilityValue('dispatch_mode', data[REG_DISPATCH_MODE]?.value != null ? String(data[REG_DISPATCH_MODE].value) : null),
      this.setCapabilityValue('dispatch_soc', data[REG_DISPATCH_SOC]?.value),
    ]);
  }

}

module.exports = BatteryDevice;
