/**
 * base logger code taken from
 * https://github.com/whitecolor/ts-node-dev/blob/master/lib/log.js
 */
import util from 'util';
import fmt from 'dateformat';

const colors = {
  info: '36',
  error: '31;1',
  log: '32',
  warn: '33',
  debug: '90',
} as const;

interface config {
  debug: boolean;
  timestamp: string;
}

type LogFunction = (format: string, ...param: string[]) => void;

interface logger {
  (msg: string, level: string): void;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
}

/**
 * Logs a message to the console. The level is displayed in ANSI colors,
 * either bright red in case of an error or green otherwise.
 */
export default function(cfg: config): logger {
  function color(s: string, c: string): string {
    if (process.stdout.isTTY) {
      return '\x1B[' + c + 'm' + s + '\x1B[0m';
    }
    return s;
  }

  function log(msg: string, level: keyof typeof colors): void {
    if (cfg.timestamp) msg = color(fmt(cfg.timestamp), '30;1') + ' ' + msg;
    const c = colors[level || 'log'];
    // eslint-disable-next-line no-console
    console.log('[' + color(level.toUpperCase(), c) + '] ' + msg);
  }

  log.debug = function(format: string, ...param: string[]): void {
    if (!cfg.debug) return;
    log(util.format(format, ...param), 'debug');
  };

  log.info = function(format: string, ...param: string[]): void {
    log(util.format(format, ...param), 'info');
  };

  log.warn = function(format: string, ...param: string[]): void {
    log(util.format(format, ...param), 'warn');
  };

  log.error = function(format: string, ...param: string[]): void {
    log(util.format(format, ...param), 'error');
  };

  return log as logger;
}
