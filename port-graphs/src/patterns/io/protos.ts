/**
 * IO Pattern Proto-gadgets - Pre-composed step + handler combinations
 */

import { protoGadget } from '../../core/context';
import { localStorageStep, fileIOStep, fileInputStep } from './steps';
import { ioHandler } from './handlers';

/**
 * LocalStorage proto-gadget
 * Usage: quick(localStorageProto, { key: 'my-key', data: undefined })
 */
export const localStorageProto = protoGadget(localStorageStep).handler(ioHandler());

/**
 * FileIO proto-gadget
 * Usage: quick(fileIOProto, { mimeType: 'application/json' })
 */
export const fileIOProto = protoGadget(fileIOStep).handler(ioHandler());

/**
 * FileInput proto-gadget
 * Usage: quick(fileInputProto, { multiple: false })
 */
export const fileInputProto = protoGadget(fileInputStep).handler(ioHandler());
