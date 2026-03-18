/*!
 * express
 * MIT Licensed
 */

import { BlockList, isIP } from 'node:net';

const DIGIT_REGEXP = /^[0-9]+$/;
const IPV4_MAPPED_REGEXP = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

const IP_RANGES = {
  linklocal: ['169.254.0.0/16', 'fe80::/10'],
  loopback: ['127.0.0.1/8', '::1/128'],
  uniquelocal: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7']
};

/**
 * Determine address of proxied request.
 *
 * @param {object} req
 * @param {Function|Array|string} trust
 * @returns {string}
 */
function proxyaddr(req, trust) {
  if (!req) {
    throw new TypeError('req argument is required');
  }

  if (!trust) {
    throw new TypeError('trust argument is required');
  }

  const addrs = all(req, trust);
  return addrs[addrs.length - 1];
}

/**
 * Get all addresses in the request, optionally stopping
 * at the first untrusted.
 *
 * @param {object} req
 * @param {Function|Array|string} [trust]
 * @returns {string[]}
 */
export function all(req, trust) {
  const addrs = forwarded(req);

  if (!trust) {
    return addrs;
  }

  if (typeof trust !== 'function') {
    trust = compile(trust);
  }

  for (let i = 0; i < addrs.length - 1; i++) {
    if (trust(addrs[i], i)) {
      continue;
    }

    addrs.length = i + 1;
    break;
  }

  return addrs;
}

/**
 * Compile argument into trust function.
 *
 * @param {Array|string} val
 * @returns {(addr: string, i?: number) => boolean}
 */
export function compile(val) {
  if (!val) {
    throw new TypeError('argument is required');
  }

  let trust;
  if (typeof val === 'string') {
    trust = val.indexOf(',') === -1
      ? [val]
      : val.split(',').map(item => item.trim());
  } else if (Array.isArray(val)) {
    trust = val.map(item => typeof item === 'string'
      ? item.trim()
      : item);
  } else {
    throw new TypeError('unsupported trust argument');
  }

  for (let i = 0; i < trust.length; i++) {
    const entry = trust[i];
    if (!Object.hasOwn(IP_RANGES, entry)) {
      continue;
    }

    const range = IP_RANGES[entry];
    trust.splice(i, 1, ...range);
    i += range.length - 1;
  }

  const block4 = new BlockList();
  const block6 = new BlockList();

  for (let i = 0; i < trust.length; i++) {
    const subnet = parseIpNotation(trust[i]);
    if (subnet.family === 'ipv4') {
      block4.addSubnet(subnet.address, subnet.prefix, 'ipv4');
    } else {
      block6.addSubnet(subnet.address, subnet.prefix, 'ipv6');
    }
  }

  return (addr) => {
    if (typeof addr !== 'string' || addr.length === 0) {
      return false;
    }

    const kind = isIP(addr);
    if (kind === 4) {
      return block4.check(addr, 'ipv4');
    }

    if (kind !== 6) {
      return false;
    }

    if (block6.check(addr, 'ipv6')) {
      return true;
    }

    const mapped = mappedIPv4(addr);
    return mapped !== null
      ? block4.check(mapped, 'ipv4')
      : false;
  };
}

proxyaddr.all = all;
proxyaddr.compile = compile;

export default proxyaddr;

function forwarded(req) {
  if (!req) {
    throw new TypeError('argument req is required');
  }

  const header = req.headers['x-forwarded-for'] || '';
  const proxyAddrs = parseForwardedFor(String(header));
  const socketAddr = req.socket
    ? req.socket.remoteAddress
    : req.connection.remoteAddress;

  return [socketAddr, ...proxyAddrs];
}

function parseForwardedFor(header) {
  if (header.length === 0) {
    return [];
  }

  return header
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .reverse();
}

function parseIpNotation(note) {
  const pos = note.lastIndexOf('/');
  const base = pos !== -1
    ? note.substring(0, pos)
    : note;

  const kind = isIP(base);
  if (!kind) {
    throw new TypeError(`invalid IP address: ${base}`);
  }

  const family = kind === 4 ? 'ipv4' : 'ipv6';
  const max = kind === 4 ? 32 : 128;
  const rawRange = pos !== -1
    ? note.substring(pos + 1)
    : null;

  let prefix;
  if (rawRange === null) {
    prefix = max;
  } else if (DIGIT_REGEXP.test(rawRange)) {
    prefix = Number.parseInt(rawRange, 10);
  } else if (kind === 4 && isIP(rawRange) === 4) {
    prefix = prefixFromNetmask(rawRange);
  } else {
    prefix = null;
  }

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) {
    throw new TypeError(`invalid range on address: ${note}`);
  }

  return { family, address: base, prefix };
}

function prefixFromNetmask(mask) {
  const octets = mask.split('.');
  if (octets.length !== 4) {
    return null;
  }

  let prefix = 0;
  let seenZero = false;

  for (let i = 0; i < octets.length; i++) {
    const octet = Number.parseInt(octets[i], 10);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }

    for (let bit = 7; bit >= 0; bit--) {
      const value = (octet >> bit) & 1;
      if (value === 1) {
        if (seenZero) {
          return null;
        }
        prefix += 1;
      } else {
        seenZero = true;
      }
    }
  }

  return prefix;
}

function mappedIPv4(addr) {
  const match = IPV4_MAPPED_REGEXP.exec(addr);
  if (!match) {
    return null;
  }

  return isIP(match[1]) === 4
    ? match[1]
    : null;
}
