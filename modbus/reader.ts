'use strict';

import { Socket } from 'net';
import { ModbusTCPClient } from 'jsmodbus';

type Register = {
  intRegister: number,
  register: string,
  // eslint-disable-next-line camelcase
  name_en: string,
  unit: string,
  type: 'string' | 'uint16be' | 'int16be' | 'uint32be' | 'int32be',
  len: number,
  factor: number,
  rw?: boolean,
  bits?: string[],
  enum?: {
    value: number,
    // eslint-disable-next-line camelcase
    name_en: string,
  }[],
  // eslint-disable-next-line camelcase
  frontend_type: 'state' | 'enum' | 'bits'
}

const DEFAULT_REGISTERS: Register[] = require('./register.json');

const UNIT_ID = 85;
const PORT = 502;

function dec2bin(dec: number) {
  return (dec >>> 0).toString(2);
}

export type ModbusResult = {
  [details: string]: {
    name: string,
    unit: string,
    value?: string | null | number,
    // eslint-disable-next-line camelcase
    value_string?: string,
    // eslint-disable-next-line camelcase
    value_name?: string,
  };
}

export class ModbusReader {

  port;
  host;

  socket = null;
  client = null;

  constructor(host: string, port: number = PORT) {
    this.host = host;
    this.port = port || PORT;
  }

  async readOnce(registers = DEFAULT_REGISTERS): Promise<ModbusResult> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const client = new ModbusTCPClient(socket, UNIT_ID);

      socket.on('error', reject);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      socket.on('connect', async () => {
        const result: ModbusResult = {};

        try {
          for (const reg of registers) {
            // eslint-disable-next-line radix
            const res = await client.readHoldingRegisters(parseInt(reg.register), reg.len);
            let val = null;

            switch (reg.type) {
              case 'string':
                val = res.response.body.valuesAsBuffer.toString().replace(/\0/ig, '');
                break;

              case 'uint16be':
                val = res.response.body.valuesAsBuffer.readUint16BE();
                break;

              case 'int16be':
                val = res.response.body.valuesAsBuffer.readInt16BE();
                break;

              case 'uint32be':
                val = res.response.body.valuesAsBuffer.readUint32BE();
                break;

              case 'int32be':
                val = res.response.body.valuesAsBuffer.readInt32BE();
                break;

              default:
                reject(new Error(`Unkonw type ${reg.type}`));
            }

            result[reg.register] = {
              name: reg.name_en,
              unit: reg.unit,
            };

            if (reg.type === 'string') {
              result[reg.register].value = val;
            }

            if (reg.frontend_type === 'bits') {
              const bitstr = dec2bin(val as number).padStart(reg.len * 16, '0');

              result[reg.register].value = bitstr;
              result[reg.register].value_string = reg.bits?.map((e, i) => {
                return bitstr[bitstr.length - i - 1] === '1' ? e : null;
              }).filter((e) => e).join(',');
            } else if (reg.frontend_type === 'enum') {
              const enumVal = reg.enum?.find((e) => e.value === val);
              result[reg.register].value = val;
              result[reg.register].value_name = enumVal ? enumVal.name_en : val?.toString();
            } else {
              result[reg.register].value = (val as number) * (reg.factor ?? 1);
            }
          }

          resolve(result);
        } finally {
          socket.destroy();
        }
      });

      const options = {
        host: this.host,
        port: this.port,
      };

      socket.connect(options);
    });
  }

  async writeOnce(register: string, value: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const client = new ModbusTCPClient(socket, UNIT_ID);

      socket.on('error', reject);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      socket.on('connect', async () => {
        try {
          // eslint-disable-next-line radix
          await client.writeSingleRegister(parseInt(register), value);
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          socket.destroy();
        }
      });

      socket.connect({
        host: this.host,
        port: this.port,
      });
    });
  }

}
