// Funcitons for setting and checking the LCD
import {
  Graphics
} from './graphics';
// Assembly script really not feeling the reexport
import {
  eightBitLoadFromGBMemory
} from '../memory/load';
import {
  eightBitStoreIntoGBMemorySkipTraps
} from '../memory/store';
import {
  requestLcdInterrupt
} from '../interrupts/index';
import {
  consoleLog,
  consoleLogTwo,
  checkBitOnByte,
  setBitOnByte,
  resetBitOnByte
} from '../helpers/index';

export function isLcdEnabled(): boolean {
  return checkBitOnByte(7, eightBitLoadFromGBMemory(Graphics.memoryLocationLcdControl));
}

export function setLcdStatus(): void {
  // LCD Status (0xFF41) bits Explanation
  // 0                0                    000                    0             00
  //       |Coicedence Interrupt|     |Mode Interrupts|  |coincidence flag|    | Mode |
  // Modes:
  // 0 or 00: H-Blank
  // 1 or 01: V-Blank
  // 2 or 10: Searching Sprites Atts
  // 3 or 11: Transfering Data to LCD Driver

  let lcdStatus: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationLcdStatus);
  if(!isLcdEnabled()) {
    // Reset scanline cycle counter
    Graphics.scanlineCycleCounter = 0;
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationScanlineRegister, 0);

    // Set to mode 1
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);

    // Store the status in memory
    eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
  }

  // Get our current scanline, and lcd mode
  let scanlineRegister: u8 = eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister);
  let lcdMode: u8 = lcdStatus & 0x03;

  let newLcdMode: u8 = 0;
  let shouldRequestInterrupt: boolean = false;

  // Find our newLcd mode
  if(scanlineRegister >= 144) {
    // VBlank mode
    newLcdMode = 1;
    lcdStatus = resetBitOnByte(1, lcdStatus);
    lcdStatus = setBitOnByte(0, lcdStatus);
    shouldRequestInterrupt = checkBitOnByte(4, lcdStatus);
  } else {
    if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_SPRITES_LCD_MODE) {
      // Searching Sprites Atts
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(5, lcdStatus);
    } else if (Graphics.scanlineCycleCounter >= Graphics.MIN_CYCLES_TRANSFER_DATA_LCD_MODE) {
      // Transferring data to lcd
      newLcdMode = 3;
      lcdStatus = setBitOnByte(0, lcdStatus);
      lcdStatus = setBitOnByte(1, lcdStatus);
    } else {
      // H-Blank
      newLcdMode = 2;
      lcdStatus = resetBitOnByte(0, lcdStatus);
      lcdStatus = resetBitOnByte(1, lcdStatus);
      shouldRequestInterrupt = checkBitOnByte(3, lcdStatus);
    }
  }

  // Check if we want to request an interrupt, and we JUST changed modes
  if(shouldRequestInterrupt && (lcdMode !== newLcdMode)) {
    requestLcdInterrupt();
  }

  // Check for the coincidence flag
  if(eightBitLoadFromGBMemory(Graphics.memoryLocationScanlineRegister) === eightBitLoadFromGBMemory(Graphics.memoryLocationCoincidenceCompare)) {
    lcdStatus = setBitOnByte(2, lcdStatus);
    if(checkBitOnByte(6, lcdStatus)) {
      requestLcdInterrupt();
    }
  } else {
    lcdStatus = resetBitOnByte(2, lcdStatus);
  }

  // Finally, save our status
  eightBitStoreIntoGBMemorySkipTraps(Graphics.memoryLocationLcdStatus, lcdStatus);
}
